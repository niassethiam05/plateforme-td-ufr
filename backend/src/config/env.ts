import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  // Adresse publique du site : origine autorisee par CORS et base des liens
  // envoyes par email. RENDER_EXTERNAL_URL est fournie automatiquement par
  // Render (https://<service>.onrender.com) ; CLIENT_URL la remplace des
  // qu'un nom de domaine propre est branche.
  clientUrl:
    process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173",

  // Nombre de reverse proxys entre Internet et ce processus (voir app.ts).
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),

  // En production, le backend sert aussi les pages du site (frontend/dist) :
  // un seul service a heberger, et pages et API partagent la meme origine,
  // ce dont dependent le cookie de session et les appels a /api.
  serveFrontend: process.env.SERVE_FRONTEND === "true",

  // Creation du premier administrateur au demarrage (voir
  // services/bootstrapAdmin.service). Sans effet des qu'un admin existe.
  bootstrapAdmin: {
    email: process.env.ADMIN_EMAIL || undefined,
    password: process.env.ADMIN_PASSWORD || undefined,
  },

  databaseUrl: required("DATABASE_URL"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },

  storage: {
    endpoint: required("STORAGE_ENDPOINT"),
    region: process.env.STORAGE_REGION ?? "us-east-1",
    bucket: required("STORAGE_BUCKET"),
    accessKeyId: required("STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: required("STORAGE_SECRET_ACCESS_KEY"),
    forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
  },

  upload: {
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 20),
  },

  // Envoi d'emails (mot de passe oublie). Tout est optionnel : sans SMTP_HOST,
  // aucun email n'est envoye (voir services/mail.service).
  mail: {
    host: process.env.SMTP_HOST || undefined,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from: process.env.MAIL_FROM ?? "Fiches de TD <no-reply@localhost>",
  },
} as const;

/**
 * En production, refuse de demarrer avec des secrets JWT faibles. Les valeurs
 * de .env.example ("change_me_...") sont publiques : les laisser en place
 * permet a n'importe qui de fabriquer un jeton d'administrateur valide.
 *
 * Les deux secrets doivent aussi differer : c'est la cle de signature qui
 * distingue un access token d'un refresh token.
 *
 * Applique uniquement en production pour ne pas bloquer un poste de
 * developpement qui utilise les valeurs d'exemple.
 */
const MIN_JWT_SECRET_LENGTH = 32;

if (env.nodeEnv === "production") {
  for (const [name, secret] of [
    ["JWT_ACCESS_SECRET", env.jwt.accessSecret],
    ["JWT_REFRESH_SECRET", env.jwt.refreshSecret],
  ] as const) {
    if (secret.length < MIN_JWT_SECRET_LENGTH || secret.startsWith("change_me")) {
      throw new Error(
        `${name} est trop faible pour la production : utilisez une valeur aleatoire d'au moins ${MIN_JWT_SECRET_LENGTH} caracteres.`
      );
    }
  }
  if (env.jwt.accessSecret === env.jwt.refreshSecret) {
    throw new Error("JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent etre differents.");
  }
}
