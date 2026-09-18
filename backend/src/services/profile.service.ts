import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, UnauthorizedError } from "../utils/AppError";
import { ChangePasswordInput, UpdateProfileInput } from "../validators/profile.validators";

const SALT_ROUNDS = 12;

const profileInclude = {
  student: { include: { formation: true, level: true } },
  teacher: true,
} as const;

type ProfileUserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl: string | null;
  student: { formation: { id: string; name: string; code: string }; level: { id: string; name: string } } | null;
  teacher: { department: string | null } | null;
};

function toProfileDto(user: ProfileUserRecord) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    formation: user.student
      ? { id: user.student.formation.id, name: user.student.formation.name, code: user.student.formation.code }
      : undefined,
    level: user.student ? { id: user.student.level.id, name: user.student.level.name } : undefined,
    department: user.teacher ? user.teacher.department : undefined,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: profileInclude });
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  return toProfileDto(user);
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  await prisma.user.update({
    where: { id: userId },
    data: { firstName: input.firstName, lastName: input.lastName },
  });

  if (user.role === Role.TEACHER && input.department !== undefined) {
    await prisma.teacher.update({
      where: { userId },
      data: { department: input.department.trim() || null },
    });
  }

  return getProfile(userId);
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw new UnauthorizedError("Mot de passe actuel incorrect");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
