import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, Role, TdFileStatus } from "@prisma/client";
import type { TdFileQuery } from "../../validators/td.validators";
import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/AppError";

// vi.hoisted : les mocks doivent exister avant que vi.mock() (qui est
// lui-meme hoiste en haut du fichier par vitest) ne s'execute.
const prismaMock = vi.hoisted(() => ({
  tdFile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  student: { findUnique: vi.fn(), findMany: vi.fn() },
  teacher: { findUnique: vi.fn() },
  favorite: { findMany: vi.fn() },
  download: { create: vi.fn() },
  subject: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({
  upload: vi.fn(),
  delete: vi.fn(),
  getObjectStream: vi.fn(),
}));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../storage/S3StorageProvider", () => ({ storageProvider: storageMock }));
vi.mock("../notification.service", () => ({
  createNotification: vi.fn(),
  createManyNotifications: vi.fn(),
}));

// Import APRES les vi.mock() : td.service.ts doit recevoir les modules mockes.
import {
  decideTdFile,
  finalizeDownload,
  finalizeView,
  getTdFileOrThrow,
  listTdFiles,
  prepareDownload,
  replaceTdFilePdf,
  submitTdFile,
  updateTdFile,
} from "../td.service";
import { createNotification } from "../notification.service";

/** Fiche PUBLISHED type, matiere en L1 de la formation "formation-A". */
function baseTdFile(overrides: Record<string, unknown> = {}) {
  return {
    id: "td-1",
    title: "TD Test",
    status: TdFileStatus.PUBLISHED,
    subjectId: "subj-1",
    teacherId: "teacher-1",
    fileKey: "key.pdf",
    subject: {
      id: "subj-1",
      name: "Algo",
      semester: {
        id: "sem-1",
        level: { id: "level-1", formationId: "formation-A", name: "L1" },
      },
    },
    teacher: {
      id: "teacher-1",
      userId: "teacher-user-1",
      user: { id: "teacher-user-1", firstName: "Fatou", lastName: "Diallo" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("td.service — listTdFiles (filtrage par filiere)", () => {
  it("un etudiant ne voit que sa propre filiere, meme s'il demande une autre formationId", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-A", levelId: "level-1" });
    prismaMock.tdFile.findMany.mockResolvedValue([]);
    prismaMock.tdFile.count.mockResolvedValue(0);

    const query: TdFileQuery = { page: 1, pageSize: 12, formationId: "formation-B" };
    await listTdFiles(query, { id: "student-1", role: Role.STUDENT });

    const callArgs = prismaMock.tdFile.findMany.mock.calls[0][0];
    expect(callArgs.where.subject.semester.level.formationId).toBe("formation-A");
  });

  it("un visiteur anonyme ne voit que les fiches publiees", async () => {
    prismaMock.tdFile.findMany.mockResolvedValue([]);
    prismaMock.tdFile.count.mockResolvedValue(0);

    const query: TdFileQuery = { page: 1, pageSize: 12 };
    await listTdFiles(query, undefined);

    const callArgs = prismaMock.tdFile.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toBe(TdFileStatus.PUBLISHED);
  });

  it("un admin sans filtre de statut voit tous les statuts", async () => {
    prismaMock.tdFile.findMany.mockResolvedValue([]);
    prismaMock.tdFile.count.mockResolvedValue(0);

    const query: TdFileQuery = { page: 1, pageSize: 12 };
    await listTdFiles(query, { id: "admin-1", role: Role.ADMIN });

    const callArgs = prismaMock.tdFile.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toBeUndefined();
  });
});

describe("td.service — getTdFileOrThrow (cloison stricte + acces proprietaire)", () => {
  it("renvoie NotFoundError si la fiche n'existe pas", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(null);
    await expect(getTdFileOrThrow("missing")).rejects.toThrow(NotFoundError);
  });

  it("renvoie NotFoundError pour un brouillon consulte par un visiteur anonyme", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));
    await expect(getTdFileOrThrow("td-1")).rejects.toThrow(NotFoundError);
  });

  it("un enseignant proprietaire peut consulter son propre brouillon (regression : comparaison sur teacher.userId, pas teacherId)", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));
    prismaMock.favorite.findMany.mockResolvedValue([]);

    const result = await getTdFileOrThrow("td-1", { id: "teacher-user-1", role: Role.TEACHER });
    expect(result.id).toBe("td-1");
  });

  it("un autre enseignant ne peut pas consulter ce brouillon", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));
    await expect(
      getTdFileOrThrow("td-1", { id: "un-autre-enseignant", role: Role.TEACHER })
    ).rejects.toThrow(NotFoundError);
  });

  it("renvoie un ForbiddenError explicite pour un etudiant d'une autre filiere", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-B" });

    await expect(getTdFileOrThrow("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      ForbiddenError
    );
  });

  it("un etudiant de la meme filiere peut consulter la fiche", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-A" });
    prismaMock.favorite.findMany.mockResolvedValue([]);

    const result = await getTdFileOrThrow("td-1", { id: "student-1", role: Role.STUDENT });
    expect(result.id).toBe("td-1");
  });
});

describe("td.service — modification d'une fiche publiee (retour en validation)", () => {
  const teacher = { id: "teacher-user-1", role: Role.TEACHER };
  const admin = { id: "admin-1", role: Role.ADMIN };

  beforeEach(() => {
    prismaMock.teacher.findUnique.mockResolvedValue({ id: "teacher-1" });
    prismaMock.tdFile.update.mockImplementation(async ({ data }) => baseTdFile(data));
    prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    storageMock.upload.mockResolvedValue({ key: "new.pdf", size: 10, contentType: "application/pdf" });
    storageMock.delete.mockResolvedValue(undefined);
  });

  it("un enseignant qui modifie sa fiche publiee la renvoie en attente et previent les admins", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());

    const updated = await updateTdFile("td-1", teacher, { title: "Nouveau titre" });

    expect(prismaMock.tdFile.update.mock.calls[0][0].data).toEqual({
      title: "Nouveau titre",
      status: TdFileStatus.PENDING,
      adminComment: null,
    });
    expect(updated.status).toBe(TdFileStatus.PENDING);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("un enseignant qui remplace le PDF de sa fiche publiee la renvoie en attente", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());

    await replaceTdFilePdf("td-1", teacher, { buffer: Buffer.from("%PDF-"), mimetype: "application/pdf", size: 5 });

    expect(prismaMock.tdFile.update.mock.calls[0][0].data).toMatchObject({
      fileKey: "new.pdf",
      status: TdFileStatus.PENDING,
    });
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("la modification d'un brouillon ne change pas son statut", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));

    await updateTdFile("td-1", teacher, { title: "Nouveau titre" });

    expect(prismaMock.tdFile.update.mock.calls[0][0].data).toEqual({ title: "Nouveau titre" });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("un admin qui modifie une fiche publiee la laisse publiee", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());

    await updateTdFile("td-1", admin, { title: "Nouveau titre" });

    expect(prismaMock.tdFile.update.mock.calls[0][0].data).toEqual({ title: "Nouveau titre" });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("un enseignant ne peut pas modifier la fiche d'un autre", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.teacher.findUnique.mockResolvedValue({ id: "teacher-2" });

    await expect(updateTdFile("td-1", teacher, { title: "x" })).rejects.toThrow(ForbiddenError);
    expect(prismaMock.tdFile.update).not.toHaveBeenCalled();
  });
});

describe("td.service — telechargement : droits verifies deux fois (emission puis flux)", () => {
  it("prepareDownload refuse une fiche non publiee", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));

    await expect(prepareDownload("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      NotFoundError
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("prepareDownload refuse un etudiant d'une autre filiere sans rien enregistrer", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-B" });

    await expect(prepareDownload("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      ForbiddenError
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("prepareDownload autorise mais ne compte pas : le simple clic n'est pas un telechargement", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-A" });

    const target = await prepareDownload("td-1", { id: "student-1", role: Role.STUDENT });

    expect(target).toEqual({ fileKey: "key.pdf", downloadFileName: "td-test.pdf" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.download.create).not.toHaveBeenCalled();
  });

  it("finalizeDownload verifie les droits au moment du flux, puis compte", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-A" });
    prismaMock.$transaction.mockResolvedValue([{}, {}]);

    const target = await finalizeDownload("td-1", { id: "student-1", role: Role.STUDENT });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(target.fileKey).toBe("key.pdf");
  });

  it("finalizeDownload refuse si la fiche a ete retiree entre l'emission du lien et le flux", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));

    await expect(finalizeDownload("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      NotFoundError
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("finalizeView refuse si le compte n'a plus acces a la fiche, sans compter", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-B" });

    await expect(finalizeView("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      ForbiddenError
    );
    expect(prismaMock.tdFile.update).not.toHaveBeenCalled();
  });

  it("finalizeView compte la vue pour un etudiant autorise", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-A" });
    prismaMock.favorite.findMany.mockResolvedValue([]);

    await finalizeView("td-1", { id: "student-1", role: Role.STUDENT });

    expect(prismaMock.tdFile.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.tdFile.update.mock.calls[0][0].data.viewCount).toEqual({ increment: 1 });
  });
});

/** Erreur renvoyee par Prisma quand la condition du `where` d'un update ne correspond plus. */
function recordNotFound() {
  return new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
    code: "P2025",
    clientVersion: "5.22.0",
  });
}

describe("td.service — fiche figee pendant la validation", () => {
  const teacher = { id: "teacher-user-1", role: Role.TEACHER };
  const admin = { id: "admin-1", role: Role.ADMIN };
  const pdf = { buffer: Buffer.from("%PDF-"), mimetype: "application/pdf", size: 5 };

  beforeEach(() => {
    prismaMock.teacher.findUnique.mockResolvedValue({ id: "teacher-1" });
    prismaMock.tdFile.update.mockImplementation(async ({ data }) => baseTdFile(data));
    prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    storageMock.upload.mockResolvedValue({ key: "new.pdf", size: 10, contentType: "application/pdf" });
    storageMock.delete.mockResolvedValue(undefined);
  });

  it("un enseignant ne peut pas modifier une fiche en attente de validation", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.PENDING }));

    await expect(updateTdFile("td-1", teacher, { title: "Autre titre" })).rejects.toThrow(ConflictError);
    expect(prismaMock.tdFile.update).not.toHaveBeenCalled();
  });

  it("un enseignant ne peut pas remplacer le PDF d'une fiche en attente, rien n'est envoye au stockage", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.PENDING }));

    await expect(replaceTdFilePdf("td-1", teacher, pdf)).rejects.toThrow(ConflictError);
    expect(storageMock.upload).not.toHaveBeenCalled();
    expect(prismaMock.tdFile.update).not.toHaveBeenCalled();
  });

  it("un admin peut corriger une fiche en attente", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.PENDING }));

    await updateTdFile("td-1", admin, { title: "Titre corrige" });

    expect(prismaMock.tdFile.update).toHaveBeenCalledTimes(1);
  });

  it("l'ecriture n'a lieu que si le statut est toujours celui lu au depart", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));

    await updateTdFile("td-1", teacher, { title: "Nouveau titre" });

    expect(prismaMock.tdFile.update.mock.calls[0][0].where).toEqual({ id: "td-1", status: TdFileStatus.DRAFT });
  });

  it("fiche soumise pendant l'envoi du PDF : 409, nouveau fichier supprime, ancien conserve", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));
    prismaMock.tdFile.update.mockRejectedValue(recordNotFound());

    await expect(replaceTdFilePdf("td-1", teacher, pdf)).rejects.toThrow(ConflictError);
    expect(storageMock.delete).toHaveBeenCalledTimes(1);
    expect(storageMock.delete).toHaveBeenCalledWith("new.pdf");
  });

  it("l'ancien PDF n'est supprime qu'apres la mise a jour de la fiche", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));

    await replaceTdFilePdf("td-1", teacher, pdf);

    expect(storageMock.delete).toHaveBeenCalledWith("key.pdf");
    expect(prismaMock.tdFile.update.mock.invocationCallOrder[0]).toBeLessThan(
      storageMock.delete.mock.invocationCallOrder[0]
    );
  });

  it("une soumission concurrente deja passee renvoie 409 sans renotifier les admins", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));
    prismaMock.tdFile.update.mockRejectedValue(recordNotFound());

    await expect(submitTdFile("td-1", teacher)).rejects.toThrow(ConflictError);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("deux decisions simultanees : la seconde renvoie 409 et ne notifie personne", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.PENDING }));
    prismaMock.tdFile.update.mockRejectedValue(recordNotFound());

    await expect(decideTdFile("td-1", true)).rejects.toThrow(ConflictError);
    expect(prismaMock.tdFile.update.mock.calls[0][0].where).toEqual({
      id: "td-1",
      status: TdFileStatus.PENDING,
    });
    expect(createNotification).not.toHaveBeenCalled();
  });
});
