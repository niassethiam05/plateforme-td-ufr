import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError, ConflictError, UnauthorizedError } from "../utils/AppError";
import { issueTokens } from "./token.service";
import { LoginInput, RegisterInput } from "../validators/auth.validators";

const SALT_ROUNDS = 12;

// Inclut le profil etudiant (formation + niveau) pour que le frontend
// puisse restreindre le catalogue a la filiere de l'utilisateur sans
// requete supplementaire.
const authUserInclude = {
  student: { include: { formation: true, level: true } },
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

/**
 * Inscription publique.
 *
* Le role est choisi librement parmi STUDENT et TEACHER (le schema Zod
 * refuse ADMIN : un visiteur ne doit pas pouvoir s'auto-attribuer un role
 * d'administration). Un compte enseignant n'a donc aucun acces immediat :
 *
 * - STUDENT  -> actif, session ouverte, acces au catalogue de sa filiere.
 * - TEACHER  -> cree INACTIF. L'administration doit le valider depuis
 *               "Utilisateurs" avant qu'il puisse se connecter. isActive est
 *               deja verifie par loginUser, requireAuth et refresh : aucun
 *               autre point d'application n'est necessaire.
 *
 * Aucun token n'est emis pour un compte en attente : l'enseignant ne peut rien
 * faire tant que l'admin n'a pas valide, donc lui rendre une session serait
 * trompeur.
 */
export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Un compte existe deja avec cet email");
  }

  const isStudent = input.role === Role.STUDENT;

  // Formation et niveau ne concernent que l'etudiant. Ce controle est donc
  // limite a STUDENT : un enseignant n'envoie pas ces champs (le schema les
  // declare optional), et chercher un niveau avec un id undefined ferait
  // echouer la requete Prisma.
  if (isStudent) {
    // Le niveau est verifie avant toute ecriture : il doit exister ET
    // appartenir a la formation declaree, sinon un compte etudiant pourrait
    // etre rattache a une filiere/niveau incoherent.
    const level = await prisma.level.findUnique({ where: { id: input.levelId! } });
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
      // Un enseignant attend une validation : le compte nait inactif.
      isActive: isStudent,
      ...(isStudent
        ? { student: { create: { formationId: input.formationId!, levelId: input.levelId! } } }
        : { teacher: { create: {} } }),
    },
    include: authUserInclude,
  });

  if (!user.isActive) {
    // Aucun token emis : le compte ne peut pas encore se connecter.
    return { user: toAuthUserDto(user), pendingApproval: true } as const;
  }

  return { ...(await buildAuthResponse(user)), pendingApproval: false } as const;
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: authUserInclude });
  if (!user || !user.isActive) {
    // Message unique pour les trois cas (compte inexistant, compte desactive,
    // enseignant en attente de validation) : les distinguer permettrait
    // d'enumerer les comptes existants et leur statut.
    throw new UnauthorizedError("Identifiants incorrects ou compte en attente de validation");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Identifiants incorrects ou compte en attente de validation");
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

async function buildAuthResponse(user: AuthUserRecord) {
  const { accessToken, refreshToken } = await issueTokens(
    user.id,
    user.role,
    user.sessionVersion
  );
  return {
    user: toAuthUserDto(user),
    accessToken,
    refreshToken,
  };
}
