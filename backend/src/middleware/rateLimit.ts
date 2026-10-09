import crypto from "crypto";
import { Request } from "express";
import rateLimit from "express-rate-limit";

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
 * 120 par 5 minutes correspond a ~60 consultations de PDF, soit largement la
 * navigation normale d'un catalogue tout en bloquant les boucles. La cle est
 * l'IP : la requete de flux n'a pas d'en-tete Authorization, donc req.user n'y
 * est pas encore connu.
 */
export const fileAccessLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Trop de demandes de consultation, veuillez réessayer dans quelques minutes.",
  },
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
 * 10 par heure laisse largement le temps de signaler plusieurs fiches.
 */
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Vous avez atteint la limite de signalements pour cette heure.",
  },
});