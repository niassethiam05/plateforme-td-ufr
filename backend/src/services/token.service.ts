import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hashRefreshToken, signAccessToken, signRefreshToken } from "../utils/jwt";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Duree de vie du refresh token : 7 jours (aligne sur JWT_REFRESH_EXPIRES_IN). */
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return REFRESH_MAX_AGE_MS;
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}

/** Duree de vie du cookie refresh : alignee sur la duree du token. */
export const REFRESH_COOKIE_MAX_AGE_MS = env.jwt.refreshExpiresIn
  ? parseDurationToMs(env.jwt.refreshExpiresIn)
  : REFRESH_MAX_AGE_MS;

/**
 * Emet un couple access + refresh token pour un utilisateur et enregistre le
 * refresh token en base (empreinte SHA-256 uniquement).
 *
 * Chaque appel cree une nouvelle FAMILLE de rotation : c'est la racine de la
 * chaine de refresh. Tant que l'utilisateur ne fait pas de logout, chaque
 * refresh cree un nouveau jeton dans la meme famille, ce qui permet de
 * detecter un rejeu (voir rotateRefreshToken).
 */
export async function issueTokens(userId: string, role: Role, sessionVersion: number): Promise<TokenPair> {
  const familyId = crypto.randomUUID();
  return issueTokensInFamily(userId, role, sessionVersion, familyId);
}

/**
 * Emet un nouveau jeton dans une famille existante (rotation). Le jeton
 * precedent de cette famille doit avoir ete revoque juste avant
 * (voir auth.controller.refresh).
 */
export async function issueTokensInFamily(
  userId: string,
  role: Role,
  sessionVersion: number,
  familyId: string
): Promise<TokenPair> {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: userId, role, sv: sessionVersion });
  const refreshToken = signRefreshToken({ sub: userId, role, sv: sessionVersion, jti, fam: familyId });

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Revoque une famille entiere de refresh tokens.
 * Utilise au logout (l'utilisateur demande la fermeture de session) et lors
 * d'une detection de rejeu : si un token deja revoque est represente, c'est
 * qu'il a ete vole, donc toutes les sessions issues de cette famille tombent.
 */
export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoque toutes les familles de refresh tokens d'un utilisateur. Utilise
 * quand le changement de mot de passe doit invalider les sessions : un
 * refresh token vole ne doit pas rester utilisable apres un changement de
 * mot de passe, pas seulement apres un logout.
 */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Supprime les refresh tokens expires. A appeler periodiquement (au demarrage
 * puis via un setInterval) : sans cela la table grossit indefiniment, chaque
 * connexion et chaque rotation y ajoutant une ligne.
 */
export async function purgeExpiredRefreshTokens(): Promise<number> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}