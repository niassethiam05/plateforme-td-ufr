import { Request, Response } from "express";
import { env } from "../config/env";
import { loginUser, registerUser, toAuthUserDto } from "../services/auth.service";
import { prisma } from "../config/prisma";
import { NotFoundError, UnauthorizedError } from "../utils/AppError";
import { hashRefreshToken, verifyRefreshToken } from "../utils/jwt";
import {
  issueTokensInFamily,
  revokeFamily,
  REFRESH_COOKIE_MAX_AGE_MS,
} from "../services/token.service";

const REFRESH_COOKIE_NAME = "refreshToken";

/**
 * `path: "/"` est explicite et repris a l'identique dans clearCookie plus
 * bas. Les attributs d'un cookie doivent correspondre exactement pour que la
 * suppression fonctionne : s'appuyer sur les valeurs par defaut de
 * res.clearCookie() ferait que la deconnexion echouerait silencieusement des
 * la premiere evolution du path.
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
};

/**
 * Inscription.
 *
 * Deux réponses possibles :
 * - compte etudiant : 201 avec session, comme un login.
 * - compte enseignant : 201 SANS token ni cookie, avec pendingApproval. Aucun
 *   cookie n'est pose dans ce cas — poser un refresh token pour un compte
 *   qui ne peut pas se connecter n'aurait aucun sens et laisserait croire a
 *   une session ouverte.
 */
export async function register(req: Request, res: Response) {
  const result = await registerUser(req.body);

  if (result.pendingApproval) {
    return res.status(201).json({
      user: result.user,
      pendingApproval: true,
      message:
        "Votre compte enseignant a bien été créé. Il sera actif après validation par l'administration.",
    });
  }

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(201).json({ user: result.user, accessToken: result.accessToken, pendingApproval: false });
}

export async function login(req: Request, res: Response) {
  const result = await loginUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ user: result.user, accessToken: result.accessToken });
}

/**
 * Logout : revoque la famille de refresh tokens portee par le cookie
 * (revocation serveur), et efface le cookie avec des options identiques a
 * celles de l'ecriture. Sans la revocation, le token resterait valide jusqu'a
 * expiration meme apres deconnexion — le clearCookie seul ne protege que le
 * navigateur courant.
 */
export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      if (payload.fam) {
        await revokeFamily(payload.fam);
      }
    } catch {
      // Cookie deja invalide ou expire : rien a revoquer, la suppression du
      // cookie suffit et le client est deconnecte dans tous les cas.
    }
  }
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
}

/**
 * Restaure une session a partir du cookie de refresh token httpOnly.
 *
 * ROTATION : chaque appel revoque le jeton presente et en emet un nouveau
 * dans la meme famille. Un refresh token vole n'est donc utilisable qu'une
 * fois : le voleur l'utilise, le vrai utilisateur est deconnecte au refresh
 * suivant (et vice versa).
 *
 * DETECTION DE REJEU : si le jeton presente correspond a une ligne deja
 * revoquee, c'est qu'il a ete rejoue apres sa rotation. On presume le vol et
 * on revoque toute la famille, ce qui deconnecte l'attaquant comme la victime.
 * Sans ce cas, le rejeu serait permanent et silencieusement tolerated.
 */
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  let payload: { sub: string; jti?: string; fam?: string; sv?: number };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  if (!payload.jti || !payload.fam) {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

  if (!stored || stored.tokenHash !== hashRefreshToken(token)) {
    // Jeton signe mais absent de la base (expire et purge, ou famille
    // completement inconnue) : refuse.
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  if (stored.revokedAt) {
    // Rejeu d'un token deja consomme : toute la famille est compromise.
    await revokeFamily(stored.familyId);
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    throw new UnauthorizedError("Session révoquée pour sécurité, veuillez vous reconnecter");
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    await revokeFamily(stored.familyId);
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { student: { include: { formation: true, level: true } } },
  });
  if (!user || !user.isActive) {
    await revokeFamily(stored.familyId);
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  // Rotation : on revoque l'ancien avant d'emettre le nouveau, dans la meme
  // famille pour que la detection de rejeu reste groupee.
  await revokeFamily(stored.familyId);
  const { accessToken, refreshToken } = await issueTokensInFamily(
    user.id,
    user.role,
    user.sessionVersion,
    stored.familyId
  );

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ user: toAuthUserDto(user), accessToken });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { student: { include: { formation: true, level: true } } },
  });
  if (!user) {
    throw new NotFoundError("Utilisateur introuvable");
  }
  res.json(toAuthUserDto(user));
}