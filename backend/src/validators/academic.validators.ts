import { z } from "zod";
import { MAX_LENGTH } from "./fields";

export const formationSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(MAX_LENGTH.title, "Nom trop long"),
  code: z.string().trim().min(1, "Le code est requis").max(MAX_LENGTH.code, "Code trop long"),
  description: z.string().max(MAX_LENGTH.description, "Description trop longue").optional(),
});

export const levelSchema = z.object({
  formationId: z.string().uuid("Formation invalide"),
  name: z.string().trim().min(1, "Le nom est requis").max(MAX_LENGTH.name, "Nom trop long"),
  order: z.number().int().default(0),
});

export const academicYearSchema = z.object({
  label: z.string().regex(/^\d{4}-\d{4}$/, "Format attendu: AAAA-AAAA"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional().default(false),
});

export const semesterSchema = z.object({
  levelId: z.string().uuid("Niveau invalide"),
  academicYearId: z.string().uuid("Année universitaire invalide"),
  name: z.string().trim().min(1, "Le nom est requis").max(MAX_LENGTH.name, "Nom trop long"),
  order: z.number().int().default(0),
});

export const subjectSchema = z.object({
  semesterId: z.string().uuid("Semestre invalide"),
  name: z.string().trim().min(1, "Le nom est requis").max(MAX_LENGTH.title, "Nom trop long"),
  code: z.string().trim().max(MAX_LENGTH.code, "Code trop long").optional(),
  mainTeacherId: z.string().uuid().optional().nullable(),
  description: z.string().max(MAX_LENGTH.description, "Description trop longue").optional(),
});

export type FormationInput = z.infer<typeof formationSchema>;
export type LevelInput = z.infer<typeof levelSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SemesterInput = z.infer<typeof semesterSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
