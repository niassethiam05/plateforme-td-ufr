import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { getAuthUserState } from "../config/authStateCache";
import { ForbiddenError, UnauthorizedError } from "../utils/AppError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Id et role immediatement disponibles dans les controllers ; `sv`
       * (session version) est emis dans les jetons courts de fichiers pour
       * pouvoir re-verifier la validite de la session au moment du flux.
       */
      user?: { id: string; role: Role; sv?: number };
    }
  }
}

/**
 * Verifie le JWT d'acces ET recharge l'etat du compte en base.
 *
 * La signature du JWT prouve seulement que le serveur l'a emis il y a moins de
 * 15 minutes : elle ne dit rien du statut actuel du compte. Sans relecture,
 * un utilisateur desactive par l'admin conserve tous ses droits jusqu'a
 * l'expiration de son access token. C'est pourquoi le role autoritaire est
 * celui de la base, et non la claim `role` du token (un role promu/revoque
 * entre-temps s'applique immediatement).
 *
 * La relecture passe par un cache de 15s (voir config/authStateCache).
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new UnauthorizedError("Token d'acces manquant"));
  }

  let payload: { sub: string; sv?: number; purpose?: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new UnauthorizedError("Token d'acces invalide ou expire"));
  }

  // Un jeton de fichier (scope "file", portee d'une URL de consultation)
  // signe avec la meme cle ne doit pas valoir comme jeton d'acces : sinon
  // le lien partage du PDF serait une session valide le temps de sa duree.
  if (payload.purpose) {
    return next(new UnauthorizedError("Token d'acces invalide ou expire"));
  }

  try {
    const state = await getAuthUserState(payload.sub);
    if (!state.isActive) {
      return next(new UnauthorizedError("Compte desactive"));
    }
    // Un token emis avant l'introduction de sessionVersion n'a pas la claim :
    // on l'aligne sur 0, la valeur par defaut en base.
    if ((payload.sv ?? 0) !== state.sessionVersion) {
      return next(new UnauthorizedError("Session invalidee, veuillez vous reconnecter"));
    }
    req.user = { id: state.userId, role: state.role as Role, sv: state.sessionVersion };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Decode le JWT d'acces s'il est present et attache l'utilisateur a la
 * requete, mais ne rejette jamais la requete si le token est absent ou
 * invalide. Utilise sur les routes publiques (catalogue, detail d'une
 * fiche) qui doivent neanmoins reconnaitre un utilisateur connecte —
 * par exemple pour qu'un enseignant voie ses propres brouillons.
 *
 * Meme controle d'etat que requireAuth, y compris pour un compte desactive :
 * ici il ne sert qu'a reconnaitre l'utilisateur, donc un etat invalide se
 * comporte comme un visiteur anonyme plutot que de renvoyer une erreur.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      // Meme refus que requireAuth : un jeton de fichier ne doit pas servir
      // a reconnaitre un utilisateur sur les routes publiques.
      const state = payload.purpose ? undefined : await getAuthUserState(payload.sub);
      if (state && state.isActive && (payload.sv ?? 0) === state.sessionVersion) {
        req.user = { id: state.userId, role: state.role as Role };
      }
    } catch {
      // Token absent/invalide : la requete continue en tant que visiteur anonyme.
    }
  }

  next();
}

/**
 * Restreint l'acces a une route selon le(s) role(s) autorise(s).
 * A utiliser apres requireAuth.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("Role insuffisant pour cette action"));
    }
    next();
  };
}