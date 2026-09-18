import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError, ConflictError, UnauthorizedError } from "../utils/AppError";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { LoginInput, RegisterInput } from "../validators/auth.validators";

const SALT_ROUNDS = 12;

// Inclut le profil etudiant (formation + niveau) pour que le frontend
// puisse restreindre le catalogue a la filiere de l'utilisateur sans
// requete supplementaire.
const authUserInclude = {
  student: { include: { formation: true, level: true } },
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Un compte existe deja avec cet email");
  }

  if (input.role === "STUDENT") {
    const level = await prisma.level.findUnique({ where: { id: input.levelId } });
    if (!level || level.formationId !== input.formationId) {
      throw new AppError("Formation ou niveau invalide", 422);
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      ...(input.role === "STUDENT"
        ? {
            student: {
              create: { formationId: input.formationId!, levelId: input.levelId! },
            },
          }
        : { teacher: { create: {} } }),
    },
    include: authUserInclude,
  });

  return buildAuthResponse(user);
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: authUserInclude });
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Identifiants incorrects");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Identifiants incorrects");
  }

  return buildAuthResponse(user);
}

export function toAuthUserDto(user: AuthUserRecord) {
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
  };
}

function buildAuthResponse(user: AuthUserRecord) {
  const payload = { sub: user.id, role: user.role };
  return {
    user: toAuthUserDto(user),
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}
