import crypto from "crypto";
import { Request } from "express";
import rateLimit from "express-rate-limit";
import { verifyAccessToken, verifyFileToken, verifyRefreshToken } from "../utils/jwt";

/*
 * Pourquoi la plupart des cles sont par COMPTE et non par IP : sur un campus,
 * tous les etudiants sortent par la meme adresse (NAT du Wi-Fi). Une limite
 * par IP y devient une limite commune a toute l'UFR : quelques dizaines
 * d'etudiants l'epuisent en usage normal, et un seul etudiant malveillant peut
 * la vider expres pour bloquer tout le monde.
 *
 * Le compte n'est retenu que si son jeton est authentique (signature
 * verifiee, un simple calcul HMAC sans acces a la base). Un jeton fabrique
 * retombe sur l'IP : sinon un attaquant pourrait choisir sa cle a volonte,
 * soit pour echapper a la limite, soit pour epuiser celle d'un autre compte.
 */

function ipKey(req: Request): string {
  return `ip:${req.ip ?? "anonymous"}`;
}

/** Compte porte par un access token valide dans l'en-tete Authorization. */
function bearerUserId(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  try {
    const payload = verifyAccessToken(header.slice(7));
    // Un jeton de fichier partage la cle de signature : il n'identifie pas
    // une session (voir requireAuth).
    return payload.purpose ? undefined : payload.sub;
  } catch {
    return undefined;
  }
}

/** Compte porte par un cookie de refresh token authentique. */
function refreshCookieUserId(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.refreshToken;
  if (typeof cookie !== "string" || !cookie) return undefined;
  try {
    return verifyRefreshToken(cookie).sub;
  } catch {
    return undefined;
  }
}

/**
 * Cle du plafond global : le compte connecte (access token, sinon cookie de
 * session), et l'IP seulement pour les visiteurs anonymes.
 */
export function apiClientKey(req: Request): string {
  const userId = bearerUserId(req) ?? refreshCookieUserId(req);
  return userId ? `user:${userId}` : ipKey(req);
}

/**
 * Cle des routes de flux PDF : elles n'ont pas d'en-tete Authorization, le
 * compte est lu dans le jeton de fichier passe en query string.
 */
export function fileStreamKey(req: Request): string {
  const token = req.query.token;
  if (typeof token === "string" && token) {
    try {
      return `user:${verifyFileToken(token).sub}`;
    } catch {
      // Jeton invalide ou expire : cle IP, la requete sera refusee ensuite.
    }
  }
  return ipKey(req);
}

/** Cle des routes deja protegees par requireAuth. */
function authenticatedUserKey(req: Request): string {
  return req.user ? `user:${req.user.id}` : ipKey(req);
}

/**
 * Garde-fou global sur toute l'API : il vise les flots anormaux, pas l'usage
 * normal ; les operations reellement couteuses (upload, PDF, signalements,
 * auth) ont leurs propres limiteurs plus serres. 1000 requetes / 15 min par
 * compte connecte, ou par IP pour les visiteurs anonymes.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: apiClientKey,
  message: { error: "TooManyRequests", message: "Trop de requêtes, veuillez réessayer." },
});

/**
 * Limite les envois de fichiers (creation et remplacement du PDF d'une
 * fiche TD) : ces routes ecrivent dans le stockage S3/MinIO et sont plus
 * couteuses qu'un endpoint JSON classique — sans limite, un compte
 * enseignant compromis (ou un bug cote frontend qui boucle) pourrait
 * remplir le bucket en quelques secondes.
 *
 * Cle par utilisateur (pas par IP) : ces routes exigent deja requireAuth,
 * donc req.user est toujours defini en pratique. Cela evite qu'un reseau
 * partage (campus, proxy) ne fasse plafonner tout le monde ensemble, et
 * garde la limite efficace meme si le compte change d'IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? "anonymous",
  message: {
    error: "TooManyRequests",
    message: "Trop d'envois de fichiers en peu de temps, veuillez réessayer dans quelques minutes.",
  },
});

/**
 * Limite l'acces aux PDFs (emission d'une URL de flux, puis requete de flux).
 *
 * Chaque consultation engage deux requetes (emission + flux) et, pour
 * l'apercu, une ecriture en base (incrementation de viewCount). Sans limite,
 * ces routes sont un amplificateur : un script peut saturer la base et le
 * stockage tout en gonflant des compteurs de statistiques qui n'ont plus
 * aucun sens.
 *
 * 60 par 5 minutes et par compte, sur chacune des deux etapes : largement la
 * navigation normale d'un catalogue, tout en bloquant les boucles. Deux
 * limiteurs distincts parce que la cle ne se lit pas au meme endroit : apres
 * requireAuth pour l'emission, dans le jeton de fichier pour le flux.
 */
const FILE_ACCESS_MESSAGE = {
  error: "TooManyRequests",
  message: "Trop de demandes de consultation, veuillez réessayer dans quelques minutes.",
};

export const fileIssueLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authenticatedUserKey,
  message: FILE_ACCESS_MESSAGE,
});

export const fileStreamLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: fileStreamKey,
  message: FILE_ACCESS_MESSAGE,
});

function loginEmail(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * Limite les tentatives de connexion ECHOUEES sur un compte donne depuis une
 * adresse donnee (cle IP + email).
 *
 * La cle n'est pas l'IP seule : sur un campus, les etudiants sortent par un
 * NAT et partagent une adresse, donc un compteur par IP plafonnerait tout
 * l'UFR des que quelques-uns se trompent de mot de passe. Avec l'email dans
 * la cle, dix erreurs sur un compte ne bloquent que ce compte, depuis cette
 * adresse.
 *
 * Les connexions reussies ne sont pas comptees (skipSuccessfulRequests) : la
 * limite vise le brute-force, pas l'usage.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => `${req.ip ?? "anonymous"}|${loginEmail(req)}`,
  message: {
    error: "TooManyRequests",
    message: "Trop de tentatives de connexion sur ce compte, veuillez réessayer dans quelques minutes.",
  },
});

/**
 * Complement de loginLimiter, par IP seule : un attaquant qui essaie un mot
 * de passe sur des centaines de comptes differents change d'email a chaque
 * requete et n'atteint jamais la limite par compte. Le plafond est large
 * (300 echecs / 15 min) pour ne pas etre atteint par les erreurs de saisie
 * cumulees d'un campus derriere un NAT.
 */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "TooManyRequests",
    message: "Trop de tentatives de connexion, veuillez réessayer dans quelques minutes.",
  },
});

/**
 * Limite les inscriptions par IP. Chaque inscription cree un compte et calcule
 * un hash bcrypt : sans limite, c'est un moyen gratuit de remplir la base.
 * 300 par heure laisse une promotion entiere s'inscrire depuis la meme salle
 * (meme adresse NAT) le jour de la rentree.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Trop d'inscriptions depuis cette adresse, veuillez réessayer plus tard.",
  },
});

/**
 * Limite les demandes de lien "mot de passe oublie" pour une adresse donnee
 * depuis une IP donnee (meme cle IP + email que loginLimiter, pour la meme
 * raison : ne pas bloquer tout un campus derriere un NAT). Chaque demande
 * aboutie envoie un email ; cinq par heure suffisent a quelqu'un qui n'a
 * pas recu le premier.
 *
 * Le service applique en plus un delai minimal entre deux emails pour un meme
 * compte, quelle que soit l'IP (voir passwordReset.service).
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.ip ?? "anonymous"}|${loginEmail(req)}`,
  message: {
    error: "TooManyRequests",
    message: "Trop de demandes de réinitialisation pour cette adresse, veuillez réessayer plus tard.",
  },
});

/**
 * Plafond par IP sur les deux routes de reinitialisation. Cote demande, il
 * empeche d'envoyer des emails a des centaines d'adresses differentes ; cote
 * validation, il borne les essais de jetons (chacun coute une requete en base).
 */
export const passwordResetIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Trop de demandes de réinitialisation, veuillez réessayer plus tard.",
  },
});

/**
 * Limite /auth/refresh et /auth/logout.
 *
 * /refresh est appele au chargement de chaque page (voir AuthBootstrap) et a
 * chaque expiration de l'access token. La cle est donc la session (empreinte
 * du cookie de refresh) et non l'IP : par IP, tous les etudiants d'un campus
 * derriere un NAT partageraient le meme compteur et se bloqueraient entre eux.
 *
 * Sans cookie, la cle retombe sur l'IP. Un attaquant qui envoie des cookies
 * aleatoires change de cle a chaque requete, mais un cookie invalide est
 * rejete a la verification de signature, avant toute requete en base ; le
 * limiteur global de app.ts borne ce cas.
 */
export const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.refreshToken;
    return typeof cookie === "string" && cookie
      ? `session:${crypto.createHash("sha256").update(cookie).digest("hex")}`
      : (req.ip ?? "anonymous");
  },
  message: {
    error: "TooManyRequests",
    message: "Trop de requêtes de session, veuillez réessayer dans quelques minutes.",
  },
});

/**
 * Limite la creation de signalements.
 *
 * Chaque signalement declenche une notification a TOUS les administrateurs
 * (voir report.service) : une seule requete utilisateur produit donc N
 * ecritures. Un etudiant connecte en boucle peut remplir la file de
 * traitement des signalements de l'administration et saturer la base.
 * 10 par heure et par compte laisse largement le temps de signaler plusieurs
 * fiches.
 */
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authenticatedUserKey,
  message: {
    error: "TooManyRequests",
    message: "Vous avez atteint la limite de signalements pour cette heure.",
  },
});