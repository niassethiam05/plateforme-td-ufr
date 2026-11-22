import { z } from "zod";
import { MAX_LENGTH } from "./fields";

export const createTdFileSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis").max(MAX_LENGTH.title, "Titre trop long"),
  description: z.string().max(MAX_LENGTH.description, "Description trop longue").optional(),
  subjectId: z.string().uuid("Matière invalide"),
  academicYearId: z.string().uuid("Année universitaire invalide"),
  tdNumber: z.coerce.number().int().positive().optional(),
});

export const updateTdFileSchema = z.object({
  title: z.string().trim().min(1).max(MAX_LENGTH.title, "Titre trop long").optional(),
  description: z.string().max(MAX_LENGTH.description, "Description trop longue").optional(),
  subjectId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  tdNumber: z.coerce.number().int().positive().optional(),
});

// L'administrateur valide (=> publication immediate) ou refuse (=> la
// fiche repasse a l'enseignant, qui peut corriger et resoumettre).
export const decideTdFileSchema = z.object({
  approve: z.boolean(),
  adminComment: z.string().max(MAX_LENGTH.comment, "Commentaire trop long").optional(),
});

export const tdFileQuerySchema = z.object({
  search: z.string().max(MAX_LENGTH.search, "Recherche trop longue").optional(),
  formationId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "PENDING", "VALIDATED", "REJECTED", "PUBLISHED"]).optional(),
  // "mine=true" : un enseignant authentifie recupere SES propres fiches
  // (tous statuts confondus), sans avoir a connaitre son Teacher.id cote
  // frontend (distinct du User.id contenu dans le JWT).
  //
  // Pas de z.coerce.boolean() : il applique Boolean() a la chaine recue, donc
  // "mine=false" valait true (toute chaine non vide est vraie).
  mine: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export type CreateTdFileInput = z.infer<typeof createTdFileSchema>;
export type UpdateTdFileInput = z.infer<typeof updateTdFileSchema>;
export type DecideTdFileInput = z.infer<typeof decideTdFileSchema>;
export type TdFileQuery = z.infer<typeof tdFileQuerySchema>;
