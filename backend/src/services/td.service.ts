import { Prisma, Role, TdFileStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { storageProvider } from "./storage/S3StorageProvider";
import { createManyNotifications, createNotification } from "./notification.service";
import { ForbiddenError, NotFoundError } from "../utils/AppError";
import { CreateTdFileInput, TdFileQuery, UpdateTdFileInput } from "../validators/td.validators";

export interface UploadedFiles {
  file: { buffer: Buffer; mimetype: string; size: number };
  coverImage?: { buffer: Buffer; mimetype: string; size: number };
}

export interface RequestUser {
  id: string;
  role: Role;
}

export const publicListInclude = {
  subject: {
    include: { semester: { include: { level: { include: { formation: true } }, academicYear: true } } },
  },
  // select (jamais "include: { user: true }") : ce endpoint est public et ne
  // doit jamais renvoyer passwordHash ou d'autres champs sensibles du User.
  teacher: {
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
    },
  },
  academicYear: true,
} satisfies Prisma.TdFileInclude;

const DIACRITICS_REGEX = /[̀-ͯ]/g;

function slugifyKeyPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Renvoie l'ensemble des tdFileId que le requerant a mis en favori, parmi ceux fournis. */
async function getFavoriteIds(userId: string, tdFileIds: string[]): Promise<Set<string>> {
  if (!tdFileIds.length) return new Set();
  const favorites = await prisma.favorite.findMany({
    where: { userId, tdFileId: { in: tdFileIds } },
    select: { tdFileId: true },
  });
  return new Set(favorites.map((f) => f.tdFileId));
}

/**
 * Cloison stricte par filiere : verifie qu'un etudiant a le droit de voir
 * cette fiche (meme filiere que son profil), au-dela du simple statut
 * PUBLISHED. Utilise partout ou une fiche est accedee individuellement par
 * son id (vue detaillee, apercu PDF, telechargement, favoris) — le
 * catalogue applique deja la restriction au niveau de la requete de liste
 * (voir listTdFiles), mais un lien direct vers l'id doit etre bloque de la
 * meme facon, sans quoi la restriction du catalogue serait cosmetique.
 *
 * Ici la fiche EXISTE et est publiee (verifie par l'appelant avant ce
 * point) : on renvoie donc un Forbidden explicite, contrairement au cas
 * "brouillon/en attente" qui renvoie NotFoundError pour ne pas confirmer
 * l'existence d'une fiche non publiee. Le message est volontairement
 * explicite (demande produit) : l'utilisateur doit comprendre POURQUOI
 * l'acces est refuse plutot que de croire a un lien casse.
 */
async function assertVisibleToStudent(
  tdFile: { subject: { semester: { level: { formationId: string } } } },
  requester?: RequestUser
) {
  if (requester?.role !== "STUDENT") return;
  const student = await prisma.student.findUnique({ where: { userId: requester.id } });
  if (student && tdFile.subject.semester.level.formationId !== student.formationId) {
    throw new ForbiddenError(
      "Cette fiche appartient à une autre filière que la vôtre et ne vous est pas accessible."
    );
  }
}

export async function listTdFiles(query: TdFileQuery, requester?: RequestUser) {
  const isAdmin = requester?.role === "ADMIN";
  const isTeacher = requester?.role === "TEACHER";
  const isStudent = requester?.role === "STUDENT";

  // "mine=true" : resout le Teacher.id du requerant (distinct de son
  // User.id) pour ne renvoyer que ses propres fiches, tous statuts
  // confondus. Sans ce flag, un enseignant navigue comme n'importe quel
  // visiteur (fiches publiees uniquement), quel que soit teacherId fourni.
  let ownTeacherId: string | undefined;
  if (isTeacher && query.mine) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: requester!.id } });
    ownTeacherId = teacher?.id;
  }

  // Un etudiant ne voit jamais que les fiches de sa propre filiere : le
  // formationId de sa requete (s'il en fournit un) est ignore au profit de
  // celui de son profil. Applique cote backend (pas seulement filtre
  // frontend) car c'est la seule barriere fiable.
  let studentFormationId: string | undefined;
  if (isStudent) {
    const student = await prisma.student.findUnique({ where: { userId: requester!.id } });
    studentFormationId = student?.formationId;
  }

  const where: Prisma.TdFileWhereInput = {};

  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.academicYearId) where.academicYearId = query.academicYearId;

  if (ownTeacherId) {
    where.teacherId = ownTeacherId;
  } else if (query.teacherId && (isAdmin || !isTeacher || !query.mine)) {
    // teacherId fourni sans "mine" : filtre standard, mais ne donne jamais
    // acces aux statuts non publies d'un AUTRE enseignant (voir plus bas).
    where.teacherId = query.teacherId;
  }

  const effectiveFormationId = studentFormationId ?? query.formationId;

  if (effectiveFormationId || query.levelId || query.semesterId) {
    where.subject = {
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      semester: {
        ...(query.levelId ? { levelId: query.levelId } : {}),
        level: effectiveFormationId ? { formationId: effectiveFormationId } : undefined,
      },
    };
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { subject: { name: { contains: query.search, mode: "insensitive" } } },
      {
        teacher: {
          user: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  // Regle de visibilite : seul un admin voit tout ; un enseignant qui
  // consulte SES propres fiches (mine=true) voit tous les statuts ; tout
  // le monde d'autre ne voit que les fiches publiees.
  if (isAdmin || ownTeacherId) {
    if (query.status) where.status = query.status as TdFileStatus;
  } else {
    where.status = TdFileStatus.PUBLISHED;
  }

  const skip = (query.page - 1) * query.pageSize;

  const [items, total] = await Promise.all([
    prisma.tdFile.findMany({
      where,
      include: publicListInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
    }),
    prisma.tdFile.count({ where }),
  ]);

  const favoriteIds = requester ? await getFavoriteIds(requester.id, items.map((item) => item.id)) : new Set<string>();

  return {
    items: items.map((item) => ({ ...item, isFavorite: favoriteIds.has(item.id) })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getTdFileOrThrow(id: string, requester?: RequestUser) {
  const tdFile = await prisma.tdFile.findUnique({ where: { id }, include: publicListInclude });
  if (!tdFile) throw new NotFoundError("Fiche introuvable");

  // Comparaison sur teacher.userId (id du User), pas teacherId (id du
  // Teacher, une entite distincte) : sinon un enseignant ne reconnaît
  // jamais ses propres brouillons.
  const isOwner = requester?.role === "TEACHER" && tdFile.teacher.userId === requester.id;
  const isAdmin = requester?.role === "ADMIN";

  if (tdFile.status !== TdFileStatus.PUBLISHED && !isOwner && !isAdmin) {
    throw new NotFoundError("Fiche introuvable");
  }

  await assertVisibleToStudent(tdFile, requester);

  const isFavorite = requester ? (await getFavoriteIds(requester.id, [id])).has(id) : false;
  return { ...tdFile, isFavorite };
}

async function requireTeacherProfile(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    throw new ForbiddenError("Profil enseignant introuvable pour cet utilisateur");
  }
  return teacher;
}

export async function createTdFile(
  userId: string,
  input: CreateTdFileInput,
  files: UploadedFiles
) {
  const teacher = await requireTeacherProfile(userId);
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) throw new NotFoundError("Matière introuvable");

  const keyPrefix = `td-files/${input.subjectId}/${Date.now()}-${slugifyKeyPart(input.title)}`;
  const fileUpload = await storageProvider.upload({
    buffer: files.file.buffer,
    key: `${keyPrefix}.pdf`,
    contentType: files.file.mimetype,
  });

  let coverImageKey: string | undefined;
  if (files.coverImage) {
    const coverUpload = await storageProvider.upload({
      buffer: files.coverImage.buffer,
      key: `${keyPrefix}-cover`,
      contentType: files.coverImage.mimetype,
    });
    coverImageKey = coverUpload.key;
  }

  return prisma.tdFile.create({
    data: {
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      academicYearId: input.academicYearId,
      tdNumber: input.tdNumber,
      teacherId: teacher.id,
      fileKey: fileUpload.key,
      fileSize: fileUpload.size,
      fileType: fileUpload.contentType,
      coverImageKey,
      status: TdFileStatus.DRAFT,
    },
    include: publicListInclude,
  });
}

async function assertCanEdit(id: string, requester: RequestUser) {
  const tdFile = await prisma.tdFile.findUnique({ where: { id } });
  if (!tdFile) throw new NotFoundError("Fiche introuvable");

  if (requester.role === "ADMIN") return tdFile;

  const teacher = await prisma.teacher.findUnique({ where: { userId: requester.id } });
  if (!teacher || tdFile.teacherId !== teacher.id) {
    throw new ForbiddenError("Vous ne pouvez modifier que vos propres fiches");
  }
  return tdFile;
}

export async function updateTdFile(id: string, requester: RequestUser, input: UpdateTdFileInput) {
  await assertCanEdit(id, requester);
  return prisma.tdFile.update({ where: { id }, data: input, include: publicListInclude });
}

export async function replaceTdFilePdf(id: string, requester: RequestUser, file: UploadedFiles["file"]) {
  const tdFile = await assertCanEdit(id, requester);
  const key = `td-files/${tdFile.subjectId}/${Date.now()}-${slugifyKeyPart(tdFile.title)}.pdf`;
  const upload = await storageProvider.upload({ buffer: file.buffer, key, contentType: file.mimetype });

  await storageProvider.delete(tdFile.fileKey).catch(() => undefined);

  return prisma.tdFile.update({
    where: { id },
    data: { fileKey: upload.key, fileSize: upload.size, fileType: upload.contentType },
    include: publicListInclude,
  });
}

export async function deleteTdFile(id: string, requester: RequestUser) {
  const tdFile = await assertCanEdit(id, requester);
  await storageProvider.delete(tdFile.fileKey).catch(() => undefined);
  if (tdFile.coverImageKey) {
    await storageProvider.delete(tdFile.coverImageKey).catch(() => undefined);
  }
  await prisma.tdFile.delete({ where: { id } });
}

/** Enseignant : passe une fiche en DRAFT/REJECTED vers PENDING (soumission). */
export async function submitTdFile(id: string, requester: RequestUser) {
  const tdFile = await assertCanEdit(id, requester);
  if (tdFile.status !== TdFileStatus.DRAFT && tdFile.status !== TdFileStatus.REJECTED) {
    throw new ForbiddenError("Seule une fiche en brouillon ou refusée peut être soumise");
  }
  const updated = await prisma.tdFile.update({
    where: { id },
    data: { status: TdFileStatus.PENDING, adminComment: null },
    include: publicListInclude,
  });

  // Notifie tous les administrateurs qu'une fiche attend leur validation.
  // Best-effort : un echec de notification ne doit jamais faire echouer
  // la soumission elle-meme.
  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } });
  const teacherName = `${updated.teacher.user.firstName} ${updated.teacher.user.lastName}`;
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: "Nouvelle fiche à valider",
        message: `"${updated.title}" a été soumise par ${teacherName} et attend votre validation.`,
        link: "/admin/validation",
      })
    )
  ).catch(() => undefined);

  return updated;
}

/** Admin : valide (=> publication immediate) ou refuse une fiche en attente. */
export async function decideTdFile(id: string, approve: boolean, adminComment?: string) {
  const tdFile = await prisma.tdFile.findUnique({ where: { id }, include: { teacher: true } });
  if (!tdFile) throw new NotFoundError("Fiche introuvable");
  if (tdFile.status !== TdFileStatus.PENDING) {
    throw new ForbiddenError("Seule une fiche en attente peut être validée ou refusée");
  }

  const updated = await prisma.tdFile.update({
    where: { id },
    data: approve
      ? { status: TdFileStatus.PUBLISHED, publishedAt: new Date(), adminComment: adminComment ?? null }
      : { status: TdFileStatus.REJECTED, adminComment: adminComment ?? null },
    include: publicListInclude,
  });

  // Notifie l'enseignant de la decision (best-effort, voir commentaire ci-dessus).
  await createNotification({
    userId: tdFile.teacher.userId,
    title: approve ? "Fiche validée" : "Fiche refusée",
    message: approve
      ? `Votre fiche "${updated.title}" a été validée et publiée.`
      : `Votre fiche "${updated.title}" a été refusée.${adminComment ? ` Commentaire : ${adminComment}` : ""}`,
    type: approve ? "TD_VALIDATED" : "TD_REJECTED",
    link: "/teacher/fiches",
  }).catch(() => undefined);

  // Notifie les etudiants concernes (meme filiere ET meme niveau que la
  // matiere de la fiche — pas toute la filiere, un TD de L1 ne concerne
  // pas les L3) qu'une nouvelle fiche est disponible. Best-effort, meme
  // logique que ci-dessus.
  if (approve) {
    const level = updated.subject.semester.level;
    const students = await prisma.student.findMany({
      where: { formationId: level.formationId, levelId: level.id },
      select: { userId: true },
    });
    await createManyNotifications(
      students.map((student) => ({
        userId: student.userId,
        title: "Nouvelle fiche publiée",
        message: `"${updated.title}" est maintenant disponible pour ${updated.subject.name}.`,
        type: "TD_PUBLISHED" as const,
        link: `/fiches/${updated.id}`,
      }))
    ).catch(() => undefined);
  }

  return updated;
}

export async function registerDownload(id: string, requester: RequestUser) {
  const tdFile = await prisma.tdFile.findUnique({ where: { id }, include: publicListInclude });
  if (!tdFile || tdFile.status !== TdFileStatus.PUBLISHED) {
    throw new NotFoundError("Fiche introuvable");
  }

  await assertVisibleToStudent(tdFile, requester);

  await prisma.$transaction([
    prisma.download.create({ data: { userId: requester.id, tdFileId: id } }),
    prisma.tdFile.update({ where: { id }, data: { downloadCount: { increment: 1 } } }),
  ]);

  const fileName = `${slugifyKeyPart(tdFile.title) || "fiche-td"}.pdf`;
  return storageProvider.getSignedUrl(tdFile.fileKey, 120, fileName);
}

export async function registerView(id: string, requester?: RequestUser) {
  const tdFile = await getTdFileOrThrow(id, requester);
  await prisma.tdFile.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  return storageProvider.getSignedUrl(tdFile.fileKey, 300);
}
