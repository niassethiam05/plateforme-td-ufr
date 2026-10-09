import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { invalidateAuthUserState } from "../config/authStateCache";
import { AppError } from "../utils/AppError";
import { sendPasswordResetEmail } from "./mail.service";

const SALT_ROUNDS = 12;

/** Duree de validite d'un lien de reinitialisation. */
const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Delai minimal entre deux emails pour un meme compte. Sans lui, n'importe qui
 * connaissant une adresse peut inonder sa boite de liens de reinitialisation,
 * en changeant d'IP pour contourner les limiteurs de debit.
 */
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

const INVALID_LINK_MESSAGE =
  "Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande.";

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Demande de reinitialisation.
 *
 * Ne renvoie rien et ne leve jamais d'erreur liee au compte : que l'adresse
 * soit inconnue, que le compte soit desactive ou qu'un email vienne de partir,
 * l'appelant repond toujours la meme chose. Distinguer les cas permettrait de
 * savoir quelles adresses ont un compte.
 *
 * Un compte inactif (enseignant en attente de validation, compte desactive)
 * ne recoit pas de lien : il ne pourrait de toute facon pas se connecter.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Insensible a la casse : l'utilisateur ne retape pas forcement son adresse
  // comme a l'inscription.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, email: true, firstName: true, isActive: true },
  });
  if (!user || !user.isActive) return;

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return;

  // 32 octets aleatoires : le jeton n'est pas devinable. Il n'est jamais
  // stocke en clair, seule son empreinte l'est.
  const token = crypto.randomBytes(32).toString("base64url");

  // Un seul lien valide a la fois : une nouvelle demande annule les precedentes.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  const resetUrl = `${env.clientUrl}/reinitialiser-mot-de-passe?token=${token}`;

  // L'envoi n'est pas attendu : un serveur SMTP lent allongerait la reponse
  // uniquement pour les adresses qui ont un compte, ce qui les trahirait.
  void sendPasswordResetEmail({
    to: user.email,
    firstName: user.firstName,
    resetUrl,
    expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
  }).catch((err) => console.error("Echec de l'envoi de l'email de reinitialisation:", err));
}

/**
 * Applique le nouveau mot de passe a partir d'un lien de reinitialisation.
 *
 * Le jeton est consomme par un UPDATE conditionnel (usedAt IS NULL, non
 * expire) : deux requetes simultanees avec le meme lien ne peuvent pas passer
 * toutes les deux.
 *
 * Comme pour un changement de mot de passe depuis le profil, toutes les
 * sessions ouvertes sont fermees : si le compte etait compromis, l'intrus est
 * deconnecte en meme temps que le mot de passe change.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);

  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  });
  if (!stored || stored.usedAt || stored.expiresAt.getTime() <= Date.now() || !stored.user.isActive) {
    throw new AppError(INVALID_LINK_MESSAGE, 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const userId = stored.user.id;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new AppError(INVALID_LINK_MESSAGE, 400);

    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  invalidateAuthUserState(userId);
}

/**
 * Supprime les liens expires ou deja utilises. Appele periodiquement avec la
 * purge des refresh tokens (voir server.ts).
 */
export async function purgeExpiredPasswordResetTokens(): Promise<number> {
  const { count } = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  });
  return count;
}
