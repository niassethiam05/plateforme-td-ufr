import { prisma } from "../config/prisma";
import { ConflictError, NotFoundError } from "../utils/AppError";
import { LevelInput } from "../validators/academic.validators";

export function listLevels(formationId?: string) {
  return prisma.level.findMany({
    where: formationId ? { formationId } : undefined,
    orderBy: [{ formationId: "asc" }, { order: "asc" }],
    include: { formation: true, _count: { select: { semesters: true } } },
  });
}

export async function getLevel(id: string) {
  const level = await prisma.level.findUnique({
    where: { id },
    include: { formation: true, semesters: { orderBy: { order: "asc" } } },
  });
  if (!level) throw new NotFoundError("Niveau introuvable");
  return level;
}

export async function createLevel(input: LevelInput) {
  const existing = await prisma.level.findUnique({
    where: { formationId_name: { formationId: input.formationId, name: input.name } },
  });
  if (existing) throw new ConflictError("Ce niveau existe déjà pour cette formation");
  return prisma.level.create({ data: input });
}

export async function updateLevel(id: string, input: Partial<LevelInput>) {
  await getLevel(id);
  return prisma.level.update({ where: { id }, data: input });
}

export async function deleteLevel(id: string) {
  await getLevel(id);
  await prisma.level.delete({ where: { id } });
}
