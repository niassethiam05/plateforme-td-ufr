import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/AppError";

export function listUsers(role?: Role) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      student: { include: { formation: true, level: true } },
      teacher: true,
    },
  });
}

export async function setUserActive(id: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  return prisma.user.update({ where: { id }, data: { isActive } });
}
