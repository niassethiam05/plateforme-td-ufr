import { Request, Response } from "express";
import { env } from "../config/env";
import { loginUser, registerUser, toAuthUserDto } from "../services/auth.service";
import { prisma } from "../config/prisma";
import { NotFoundError, UnauthorizedError } from "../utils/AppError";
import { signAccessToken, verifyRefreshToken } from "../utils/jwt";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};

export async function register(req: Request, res: Response) {
  const result = await registerUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
}

export async function login(req: Request, res: Response) {
  const result = await loginUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ user: result.user, accessToken: result.accessToken });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME);
  res.status(204).send();
}

/**
 * Restaure une session a partir du cookie de refresh token httpOnly
 * (utilise par le frontend au chargement de l'application, puisque
 * l'access token n'est jamais persiste cote client).
 */
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { student: { include: { formation: true, level: true } } },
  });
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
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
