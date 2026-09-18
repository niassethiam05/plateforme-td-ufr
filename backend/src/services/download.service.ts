import { prisma } from "../config/prisma";
import { publicListInclude } from "./td.service";
import { DownloadHistoryQuery } from "../validators/download.validators";

/**
 * Historique des telechargements de l'utilisateur, du plus recent au plus
 * ancien. Chaque telechargement est conserve tel quel (pas de deduplication) :
 * si une fiche a ete telechargee plusieurs fois, elle apparait plusieurs fois.
 */
export async function listDownloadHistory(userId: string, query: DownloadHistoryQuery) {
  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await Promise.all([
    prisma.download.findMany({
      where: { userId },
      orderBy: { downloadedAt: "desc" },
      skip,
      take: query.pageSize,
      include: { tdFile: { include: publicListInclude } },
    }),
    prisma.download.count({ where: { userId } }),
  ]);

  return {
    items: items.map((download) => ({
      id: download.id,
      downloadedAt: download.downloadedAt,
      tdFile: download.tdFile,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
