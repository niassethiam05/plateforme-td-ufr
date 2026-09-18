import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/AppError";
import { SubjectInput } from "../validators/academic.validators";

export function listSubjects(semesterId?: string) {
  return prisma.subject.findMany({
    where: semesterId ? { semesterId } : undefined,
    orderBy: { name: "asc" },
    include: {
      semester: { include: { level: { include: { formation: true } }, academicYear: true } },
      // select (jamais "include: { user: true }") : evite de renvoyer
      // passwordHash et les autres champs sensibles du User sur ce endpoint public.
      mainTeacher: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        },
      },
      _count: { select: { tdFiles: true } },
    },
  });
}

export async function getSubject(id: string) {
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      semester: { include: { level: { include: { formation: true } }, academicYear: true } },
      // select (jamais "include: { user: true }") : evite de renvoyer
      // passwordHash et les autres champs sensibles du User sur ce endpoint public.
      mainTeacher: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!subject) throw new NotFoundError("Matière introuvable");
  return subject;
}

export function createSubject(input: SubjectInput) {
  return prisma.subject.create({ data: input });
}

export async function updateSubject(id: string, input: Partial<SubjectInput>) {
  await getSubject(id);
  return prisma.subject.update({ where: { id }, data: input });
}

export async function deleteSubject(id: string) {
  await getSubject(id);
  await prisma.subject.delete({ where: { id } });
}
