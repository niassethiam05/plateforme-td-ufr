import { z } from "zod";
import { existingPasswordField, MAX_LENGTH, newPasswordField } from "./fields";

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis").max(MAX_LENGTH.name, "Prénom trop long"),
  lastName: z.string().trim().min(1, "Le nom est requis").max(MAX_LENGTH.name, "Nom trop long"),
  // Pertinent uniquement pour un enseignant ; ignore silencieusement pour
  // les autres roles (voir profile.service.ts).
  department: z.string().max(200).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: existingPasswordField("Le mot de passe actuel est requis"),
    newPassword: newPasswordField("Le nouveau mot de passe doit contenir au moins 8 caractères"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Le nouveau mot de passe doit être différent de l'ancien",
    path: ["newPassword"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
