import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | undefined;

function getTransporter(): Transporter | undefined {
  if (!env.mail.host) return undefined;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      // 465 = TLS des la connexion ; les autres ports (587) passent par STARTTLS.
      secure: env.mail.port === 465,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envoie le lien de reinitialisation du mot de passe.
 *
 * Sans serveur SMTP configure (SMTP_HOST vide) :
 * - en developpement, le lien est affiche dans la console pour pouvoir tester
 *   le parcours sans compte d'envoi d'emails ;
 * - en production, rien n'est affiche — le lien vaut un acces au compte et ne
 *   doit pas finir dans les journaux du serveur. Une erreur signale l'oubli de
 *   configuration.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    if (env.nodeEnv === "production") {
      console.error("SMTP non configure (SMTP_HOST) : email de reinitialisation non envoye.");
    } else {
      console.log(`[mail] Lien de reinitialisation pour ${params.to} : ${params.resetUrl}`);
    }
    return;
  }

  const intro = `Bonjour ${params.firstName},`;
  const body =
    "Vous avez demandé à réinitialiser votre mot de passe sur la plateforme des fiches de TD.";
  const validity = `Ce lien est valable ${params.expiresInMinutes} minutes et ne peut servir qu'une fois.`;
  const ignore =
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.";

  await transport.sendMail({
    from: env.mail.from,
    to: params.to,
    subject: "Réinitialisation de votre mot de passe",
    text: `${intro}\n\n${body}\n\n${params.resetUrl}\n\n${validity}\n\n${ignore}`,
    html: `<p>${escapeHtml(intro)}</p><p>${body}</p><p><a href="${escapeHtml(params.resetUrl)}">Choisir un nouveau mot de passe</a></p><p>${validity}</p><p>${ignore}</p>`,
  });
}
