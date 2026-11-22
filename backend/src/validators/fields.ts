import { z } from "zod";

/**
 * Regles de champ partagees par plusieurs schemas.
 *
 * Chaque texte libre a une longueur maximale : sans elle, un seul formulaire
 * peut envoyer plusieurs megaoctets (dans la limite du parseur JSON), qui sont
 * ensuite stockes en base, renvoyes dans chaque liste du catalogue et parcourus
 * par chaque recherche.
 */
export const MAX_LENGTH = {
  email: 254,
  name: 100,
  title: 200,
  code: 50,
  comment: 2000,
  description: 5000,
  search: 200,
} as const;

/**
 * Email ramene en minuscules : le meme compte ne doit pas pouvoir etre cree
 * deux fois sous "Fall@ufr.sn" et "fall@ufr.sn", et la connexion ne doit pas
 * dependre de la casse tapee.
 */
export const emailField = z
  .string()
  .trim()
  .max(MAX_LENGTH.email, "Email trop long")
  .email("Email invalide")
  .transform((value) => value.toLowerCase());

/**
 * bcrypt ne prend en compte que les 72 premiers OCTETS du mot de passe : au-dela,
 * deux mots de passe differents donnent la meme empreinte. La limite est en
 * octets, pas en caracteres (un caractere accentue en UTF-8 en occupe deux).
 */
export const BCRYPT_MAX_BYTES = 72;

/** Nouveau mot de passe (inscription, reinitialisation, changement). */
export const newPasswordField = (minMessage: string) =>
  z
    .string()
    .min(8, minMessage)
    .refine((value) => Buffer.byteLength(value, "utf8") <= BCRYPT_MAX_BYTES, {
      message: "Le mot de passe ne doit pas dépasser 72 caractères",
    });

/**
 * Mot de passe saisi pour etre compare a une empreinte existante (connexion,
 * mot de passe actuel). Pas de limite a 72 octets ici : un compte cree avant
 * cette regle doit pouvoir se connecter. La borne sert seulement a refuser
 * les charges absurdes.
 */
export const existingPasswordField = (requiredMessage: string) =>
  z.string().min(1, requiredMessage).max(1000, "Mot de passe trop long");
