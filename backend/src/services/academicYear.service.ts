import { prisma } from "../config/prisma";
import { ConflictError, NotFoundError } from "../utils/AppError";
import { AcademicYearInput } from "../validators/academic.validators";

export function listAcademicYears() {
  return prisma.academicYear.findMany({ orderBy: { startDate: "desc" } });
}

export async function getAcademicYear(id: string) {
  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) throw new NotFoundError("Année universitaire introuvable");
  return year;
}

export async function createAcademicYear(input: AcademicYearInput) {
  const existing = await prisma.academicYear.findUnique({ where: { label: input.label } });
  if (existing) throw new ConflictError("Cette année universitaire existe déjà");

  if (input.isCurrent) {
    await prisma.academicYear.updateMany({ data: { isCurrent: false }, where: { isCurrent: true } });
  }

  return prisma.academicYear.create({ data: input });
}

export async function updateAcademicYear(id: string, input: Partial<AcademicYearInput>) {
  await getAcademicYear(id);

  if (input.isCurrent) {
    await prisma.academicYear.updateMany({ data: { isCurrent: false }, where: { isCurrent: true } });
  }

  return prisma.academicYear.update({ where: { id }, data: input });
}

export async function deleteAcademicYear(id: string) {
  await getAcademicYear(id);
  await prisma.academicYear.delete({ where: { id } });
}
