import { Role, TdFileStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ForbiddenError } from "../utils/AppError";

export async function getAdminStats() {
  const [students, teachers, subjects, tdFiles, published, pending, downloads, reports] =
    await Promise.all([
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.TEACHER } }),
      prisma.subject.count(),
      prisma.tdFile.count(),
      prisma.tdFile.count({ where: { status: TdFileStatus.PUBLISHED } }),
      prisma.tdFile.count({ where: { status: TdFileStatus.PENDING } }),
      prisma.download.count(),
      prisma.report.count({ where: { status: "PENDING" } }),
    ]);

  const mostDownloaded = await prisma.tdFile.findMany({
    where: { status: TdFileStatus.PUBLISHED },
    orderBy: { downloadCount: "desc" },
    take: 5,
    select: { id: true, title: true, downloadCount: true },
  });

  return {
    students,
    teachers,
    subjects,
    tdFiles,
    published,
    pending,
    downloads,
    pendingReports: reports,
    mostDownloaded,
  };
}

export async function getTeacherStats(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError("Profil enseignant introuvable");

  const [total, published, pending, rejected, downloadsAgg] = await Promise.all([
    prisma.tdFile.count({ where: { teacherId: teacher.id } }),
    prisma.tdFile.count({ where: { teacherId: teacher.id, status: TdFileStatus.PUBLISHED } }),
    prisma.tdFile.count({ where: { teacherId: teacher.id, status: TdFileStatus.PENDING } }),
    prisma.tdFile.count({ where: { teacherId: teacher.id, status: TdFileStatus.REJECTED } }),
    prisma.tdFile.aggregate({
      where: { teacherId: teacher.id },
      _sum: { downloadCount: true },
    }),
  ]);

  const mostPopular = await prisma.tdFile.findMany({
    where: { teacherId: teacher.id, status: TdFileStatus.PUBLISHED },
    orderBy: { downloadCount: "desc" },
    take: 5,
    select: { id: true, title: true, downloadCount: true },
  });

  return {
    total,
    published,
    pending,
    rejected,
    totalDownloads: downloadsAgg._sum.downloadCount ?? 0,
    mostPopular,
  };
}
