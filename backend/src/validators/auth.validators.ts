import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email("Email invalide"),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
    firstName: z.string().min(1, "Le prenom est requis"),
    lastName: z.string().min(1, "Le nom est requis"),
    role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
    // Requis uniquement pour un etudiant (voir refine ci-dessous) : permet
    // de rattacher immediatement le compte a la bonne formation/niveau.
    formationId: z.string().uuid().optional(),
    levelId: z.string().uuid().optional(),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
