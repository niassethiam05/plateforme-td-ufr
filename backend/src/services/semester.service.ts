import { prisma } from "../config/prisma";
import { ConflictError, NotFoundError } from "../utils/AppError";
import { SemesterInput } from "../validators/academic.validators";

export function listSemesters(levelId?: string, academicYearId?: string) {
  return prisma.semester.findMany({
    where: {
      ...(levelId ? { levelId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
    },
    orderBy: [{ order: "asc" }],
    include: {
      level: { include: { formation: true } },
      academicYear: true,
      _count: { select: { subjects: true } },
    },
  });
}

export async function getSemester(id: string) {
  const semester = await prisma.semester.findUnique({
    where: { id },
    include: {
      level: { include: { formation: true } },
      academicYear: true,
      subjects: true,
    },
  });
  if (!semester) throw new NotFoundError("Semestre introuvable");
  return semester;
}

export async function createSemester(input: SemesterInput) {
  const existing = await prisma.semester.findUnique({
    where: {
      levelId_academicYearId_name: {
        levelId: input.levelId,
        academicYearId: input.academicYearId,
        name: input.name,
      },
    },
  });
  if (existing) throw new ConflictError("Ce semestre existe déjà pour ce niveau et cette année");
  return prisma.semester.create({ data: input });
}

export async function updateSemester(id: string, input: Partial<SemesterInput>) {
  await getSemester(id);
  return prisma.semester.update({ where: { id }, data: input });
}

export async function deleteSemester(id: string) {
  await getSemester(id);
  await prisma.semester.delete({ where: { id } });
}
