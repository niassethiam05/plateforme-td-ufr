import { prisma } from "../config/prisma";
import { getTdFileOrThrow, RequestUser } from "./td.service";
import { publicListInclude, toPublicTdFile } from "./td.service";

/** Liste les fiches mises en favori par l'utilisateur, les plus recentes d'abord. */
export async function listFavorites(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { tdFile: { include: publicListInclude } },
  });

  // Une fiche depubliee apres avoir ete mise en favori reste dans la liste
  // (l'utilisateur doit pouvoir la retirer) mais n'est pas presentee comme
  // consultable : le frontend s'appuie sur le statut pour l'indiquer.
  return favorites.map((favorite) => ({
    ...toPublicTdFile(favorite.tdFile),
    isFavorite: true,
    favoritedAt: favorite.createdAt,
  }));
}

/**
 * Ajoute une fiche aux favoris de l'utilisateur (idempotent).
 * Reutilise getTdFileOrThrow (meme regle que la vue detaillee : fiche
 * publiee ET, pour un etudiant, de sa propre filiere) pour ne jamais
 * permettre de mettre en favori une fiche qu'on n'a pas le droit de voir.
 */
export async function addFavorite(requester: RequestUser, tdFileId: string) {
  await getTdFileOrThrow(tdFileId, requester);

  await prisma.favorite.upsert({
    where: { userId_tdFileId: { userId: requester.id, tdFileId } },
    update: {},
    create: { userId: requester.id, tdFileId },
  });
}

/** Retire une fiche des favoris (idempotent : ne renvoie pas d'erreur si absente). */
export async function removeFavorite(userId: string, tdFileId: string) {
  await prisma.favorite.deleteMany({ where: { userId, tdFileId } });
}
