import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { createNotification } from "./notification.service";
import { publicListInclude } from "./td.service";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/AppError";
import { CreateReportInput, ReportQuery } from "../validators/report.validators";

/** Signale une fiche publiee. Tout utilisateur connecte peut signaler. */
export async function createReport(userId: string, tdFileId: string, input: CreateReportInput) {
  const tdFile = await prisma.tdFile.findUnique({ where: { id: tdFileId } });
  if (!tdFile || tdFile.status !== "PUBLISHED") {
    throw new NotFoundError("Fiche introuvable");
  }

  // Un seul signalement en attente par utilisateur et par fiche : chaque
  // signalement notifie tous les administrateurs, et dix signalements
  // identiques n'apportent rien de plus qu'un seul. Une fois le premier
  // traite, l'utilisateur peut signaler a nouveau.
  const alreadyPending = await prisma.report.findFirst({
    where: { userId, tdFileId, status: "PENDING" },
    select: { id: true },
  });
  if (alreadyPending) {
    throw new ConflictError("Vous avez déjà signalé cette fiche ; votre signalement est en cours d'examen.");
  }

  const report = await prisma.report.create({
    data: { userId, tdFileId, reason: input.reason, description: input.description },
  });

  // Notifie tous les administrateurs actifs (best-effort, voir td.service pour
  // le meme pattern sur la soumission d'une fiche).
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: "Nouveau signalement",
        message: `La fiche "${tdFile.title}" a été signalée (${input.reason}).`,
        link: "/admin/signalements",
      })
    )
  ).catch(() => undefined);

  return report;
}

const reportInclude = {
  tdFile: { include: publicListInclude },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export async function listReports(query: ReportQuery) {
  const skip = (query.page - 1) * query.pageSize;
  const where = query.status ? { status: query.status } : {};

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
      include: reportInclude,
    }),
    prisma.report.count({ where }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Admin : marque un signalement en attente comme traite ou classe sans suite. */
export async function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
  const report = await prisma.report.findUnique({ where: { id }, include: { tdFile: true } });
  if (!report) throw new NotFoundError("Signalement introuvable");
  if (report.status !== "PENDING") {
    throw new ForbiddenError("Ce signalement a déjà été traité");
  }

  const updated = await prisma.report.update({
    where: { id },
    data: { status, resolvedAt: new Date() },
    include: reportInclude,
  });

  await createNotification({
    userId: report.userId,
    title: "Votre signalement a été traité",
    message:
      status === "RESOLVED"
        ? `Merci, votre signalement sur "${report.tdFile.title}" a été pris en compte.`
        : `Votre signalement sur "${report.tdFile.title}" a été examiné et classé sans suite.`,
    type: "REPORT_UPDATE",
  }).catch(() => undefined);

  return updated;
}
