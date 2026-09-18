import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { ForbiddenError, UnauthorizedError } from "../utils/AppError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

/**
 * Verifie le JWT d'acces et attache l'utilisateur a la requete.
 * Toute route protegee doit passer par ce middleware: le frontend
 * n'est jamais la seule barriere de securite.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new UnauthorizedError("Token d'acces manquant"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError("Token d'acces invalide ou expire"));
  }
}

/**
 * Decode le JWT d'acces s'il est present et attache l'utilisateur a la
 * requete, mais ne rejette jamais la requete si le token est absent ou
 * invalide. Utilise sur les routes publiques (catalogue, detail d'une
 * fiche) qui doivent neanmoins reconnaitre un utilisateur connecte —
 * par exemple pour qu'un enseignant voie ses propres brouillons.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Token absent/expire : la requete continue en tant que visiteur anonyme.
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
