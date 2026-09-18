import { prisma } from "../config/prisma";
import { ConflictError, NotFoundError } from "../utils/AppError";
import { FormationInput } from "../validators/academic.validators";

export function listFormations() {
  return prisma.formation.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { levels: true, students: true } } },
  });
}

export async function getFormation(id: string) {
  const formation = await prisma.formation.findUnique({
    where: { id },
    include: { levels: { orderBy: { order: "asc" } } },
  });
  if (!formation) throw new NotFoundError("Formation introuvable");
  return formation;
}

export async function createFormation(input: FormationInput) {
  const existing = await prisma.formation.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Une formation avec ce code existe déjà");
  return prisma.formation.create({ data: input });
}

export async function updateFormation(id: string, input: Partial<FormationInput>) {
  await getFormation(id);
  return prisma.formation.update({ where: { id }, data: input });
}

export async function deleteFormation(id: string) {
  await getFormation(id);
  await prisma.formation.delete({ where: { id } });
}
