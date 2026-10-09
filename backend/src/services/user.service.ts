import { Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { invalidateAuthUserState } from "../config/authStateCache";
import { AppError, NotFoundError } from "../utils/AppError";
import { revokeAllForUser } from "./token.service";

/**
 * Champs renvoyes par les operations d'administration sur un compte.
 * `passwordHash` en est explicitement absent : un `update` sans `select`
 * renvoie l'integralite de la ligne, donc l'empreinte du mot de passe partait
 * dans la reponse JSON du PATCH /api/users/:id/active.
 */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  teacherApprovedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;



/**
 * Liste les comptes pour l'ecran d'administration.
 *
 * `filter` accepte les trois roles, plus "PENDING" qui n'est pas un role mais
 * un filtre metier : comptes ENSEIGNANTS inactifs dont teacherApprovedAt est
 * null, donc en attente de validation. Le role fait partie du filtre :
 * teacherApprovedAt est null pour tout etudiant, donc sans lui un etudiant
 * desactive apparaissait dans la liste "A valider". Le filtre est applique en base
 * (et non cote client) pour que le compteur "A valider (n)" et la liste
 * affichee restent coherents sans avoir a charger tous les utilisateurs.
 */
export function listUsers(filter?: Role | "PENDING") {
  const where: Prisma.UserWhereInput | undefined =
    filter === "PENDING"
      ? { role: Role.TEACHER, isActive: false, teacherApprovedAt: null }
      : filter
        ? { role: filter }
        : undefined;

  return prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      ...SAFE_USER_SELECT,
      student: { include: { formation: true, level: true } },
      teacher: true,
    },
  });
}

/**
 * Active/desactive un compte.
 *
 * teacherApprovedAt est pose a l'activation d'un enseignant. C'est ce qui
 * distingue "jamais valide par l'administration" (inactif + approvedAt NULL)
 * de "valide puis desactive" (inactif + approvedAt renseigné) : sans cette
 * separation, l'admin ne sait pas, dans la liste des utilisateurs, s'il
 * valide une nouvelle demande ou s'il reapplique un acces.
 *
 * Increment sessionVersion et revoquer les refresh tokens sont indissociables :
 * la version invalide les access tokens deja distribues, la revocation des
 * refresh tokens empeche d'obtenir un nouvel access token meme apres une
 * reconnexion. Sans les deux, un compte desactive conserve son acces pendant
 * toute la duree de validite de son access token.
 *
 * `actingAdminId` est optionnel pour que les tests puissent appeler le service
 * sans simuler d'appelant ; en production, le controller le transmet toujours.
 */
export async function setUserActive(id: string, isActive: boolean, actingAdminId?: string) {
  // Un admin qui se desactive lui-meme se verrouille hors de la plateforme :
  // personne ne peut alors se reconnecter pour le reactiver. Le blocage est
  // ici, cote service, pour rester applique quel que soit le point d'appel.
  if (!isActive && actingAdminId !== undefined && actingAdminId === id) {
    throw new AppError("Vous ne pouvez pas desactiver votre propre compte.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  // Memes garde-fous cote cible : on ne desactive pas le dernier
  // administrateur actif, meme si l'appelant est un autre admin. Sans cela,
  // deux admins actifs peuvent se desactiver mutuellement ou se laisser dans
  // un etat sans aucune administration possible.
  if (!isActive && user.role === Role.ADMIN) {
    const activeAdmins = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });
    if (activeAdmins <= 1) {
      throw new AppError(
        "Impossible de desactiver le dernier administrateur actif de la plateforme.",
        400
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive,
      // Premiere validation seulement : une reactivation ulterieure ne doit
      // pas ecraser la date de validation d'origine.
      ...(isActive && user.role === Role.TEACHER && !user.teacherApprovedAt
        ? { teacherApprovedAt: new Date() }
        : {}),
      ...(isActive ? {} : { sessionVersion: { increment: 1 } }),
    },
    select: SAFE_USER_SELECT,
  });

  // Desactivation = revoquer les sessions ; reactivation aussi, pour ne pas
  // laisser un ancien jeton d'avant la desactivation redevenir exploitable
  // au moment ou le compte est retabli.
  await revokeAllForUser(id);
  invalidateAuthUserState(id);

  return updated;
}
