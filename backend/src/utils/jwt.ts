import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { Role } from "@prisma/client";

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  /**
   * Marqueur de portee. Present uniquement sur les jetons de type fichier
   * (voir signFileToken), qui partagent la cle d'acces mais ne doivent jamais
   * etre acceptes comme access token — sinon un lien de consultation de 120 s
   * deviendrait un jeton d'acces valide pendant la meme fenetre.
   * requireAuth et optionalAuth refusent tout token portant ce claim.
   */
  purpose?: string;
  /**
   * Version de session au moment de l'emission. Comparee a la valeur en base
   * par requireAuth : incrementer User.sessionVersion invalide immediatement
   * tous les tokens deja emis (desactivation, changement de mot de passe).
   * Si absente (token emis avant le deploiement du schema), traitee comme 0
   * par requireAuth — voir le default applique lors de la verification.
   */
  sv?: number;
  /** Identifiant du jeton refresh (uniquement dans les refresh tokens). */
  jti?: string;
  /** Famille de rotation (uniquement dans les refresh tokens). */
  fam?: string;
}

export function signAccessToken(payload: Omit<JwtPayload, "jti" | "fam">): string {
  const options: jwt.SignOptions = {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function signRefreshToken(
  payload: Omit<JwtPayload, "jti" | "fam"> & { jti: string; fam: string }
): string {
  const options: jwt.SignOptions = {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret, {
    algorithms: ["HS256"],
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret, {
    algorithms: ["HS256"],
  }) as JwtPayload;
}

/**
 * Empreinte SHA-256 du jeton, stockee en base a la place du jeton lui-meme :
 * une fuite de la table refresh_tokens ne donne aucun jeton exploitable tel
 * quel : reconstituer un jeton exige en plus la cle de signature JWT.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Portee d'un jeton delivre pour servir un fichier via l'URL signee.
 *
 * Un <iframe> ou un clic droit sur un telechargement n'envoie pas l'en-tete
 * Authorization, donc l'access token (qui sert pour les requetes axios) ne peut
 * pas servir a cet usage. Ce jeton, transmis en parametre de requete, le
 * remplace sur ce chemin specifique.
 *
 * Deux contraintes, pour qu'il ne devienne pas une porte ouverte :
 *
 * - `purpose: "file"` l'empeche d'etre accepte comme access token (voir
 *   requireAuth/optionalAuth, qui refusent tout jeton porte). Le partage de
 *   cle de signature entre les deux n'a donc pas de consequence.
 * - `sv` (session version) et `tdId` sont verifiees a chaque requete de flux :
 *   le compte est relu en base et le fichier doit etre celui pour lequel le
 *   jeton a ete emis. Une desactivation effectif entre l'emission et l'acces
 *   est donc refusee.
 *
 * Duree courte (120 s) : le temps de charger la page, pas celui de partager le
 * lien.
 */
export interface FileTokenPayload {
  sub: string;
  sv: number;
  tdId: string;
  scope: "view" | "download";
  purpose: "file";
}

export function signFileToken(payload: FileTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: 120 });
}

export function verifyFileToken(token: string): FileTokenPayload {
  const payload = jwt.verify(token, env.jwt.accessSecret, {
    algorithms: ["HS256"],
  }) as FileTokenPayload;

  if (payload.purpose !== "file" || !payload.tdId || !payload.scope) {
    throw new Error("Jeton de fichier invalide");
  }
  return payload;
}