import { z } from "zod";

/**
 * Transforme "" en absent avant validation.
 *
 * Les formulaires HTML envoient une chaine vide pour un champ laisse vide, ce
 * qui est different de l'absence du champ. Sans cette normalisation, un
 * `optional()` laisse passer la chaine jusqu'a la validation de format, ou elle
 * echoue ("" n'est pas un UUID valide).
 */
function emptyStringAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional()
  );
}

/**
 * Inscription publique.
 *
 * ADMIN est volontairement absent de l'enum : un visiteur ne doit pas pouvoir
 * s'auto-attribuer un role d'administration. STUDENT et TEACHER sont acceptes,
 * mais un compte TEACHER nait inactif — il attend une validation de
 * l'administration avant de pouvoir se connecter (voir registerUser).
 */
export const registerSchema = z
  .object({
    email: z.string().email("Email invalide"),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
    firstName: z.string().min(1, "Le prenom est requis"),
    lastName: z.string().min(1, "Le nom est requis"),
    role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
    // Requis uniquement pour un etudiant (voir refine ci-dessous) : permet
    // de rattacher immediatement le compte a la bonne formation/niveau.
    //
    // La chaine vide est normalisee en "absent" : un formulaire qui n'affiche
    // pas ces champs pour un enseignant envoie quand meme "" plutot que de
    // les omettre, et `optional()` ne couvre pas ce cas — "" est une valeur
    // presente, donc invalide comme UUID, et l'inscription d'un enseignant
    // echouait en 422 pour un motif sans rapport avec sa demande.
    formationId: emptyStringAsUndefined(z.string().uuid("Formation invalide")),
    levelId: emptyStringAsUndefined(z.string().uuid("Niveau invalide")),
  })
  .refine((data) => data.role !== "STUDENT" || !!data.formationId, {
    message: "La formation est requise pour un compte étudiant",
    path: ["formationId"],
  })
  .refine((data) => data.role !== "STUDENT" || !!data.levelId, {
    message: "Le niveau est requis pour un compte étudiant",
    path: ["levelId"],
  });

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Lien de réinitialisation manquant").max(200),
  // Meme regle qu'a l'inscription et qu'au changement depuis le profil.
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
