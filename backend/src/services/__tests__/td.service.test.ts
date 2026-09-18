import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, TdFileStatus } from "@prisma/client";
import type { TdFileQuery } from "../../validators/td.validators";
import { ForbiddenError, NotFoundError } from "../../utils/AppError";

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
  getSignedUrl: vi.fn(),
}));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../storage/S3StorageProvider", () => ({ storageProvider: storageMock }));
vi.mock("../notification.service", () => ({
  createNotification: vi.fn(),
  createManyNotifications: vi.fn(),
}));

// Import APRES les vi.mock() : td.service.ts doit recevoir les modules mockes.
import { getTdFileOrThrow, listTdFiles, registerDownload } from "../td.service";

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

describe("td.service — registerDownload", () => {
  it("bloque le telechargement d'une fiche non publiee", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile({ status: TdFileStatus.DRAFT }));

    await expect(registerDownload("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      NotFoundError
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("bloque le telechargement pour un etudiant d'une autre filiere sans rien enregistrer", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-B" });

    await expect(registerDownload("td-1", { id: "student-1", role: Role.STUDENT })).rejects.toThrow(
      ForbiddenError
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("autorise et enregistre le telechargement pour un etudiant de la bonne filiere", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue(baseTdFile());
    prismaMock.student.findUnique.mockResolvedValue({ formationId: "formation-A" });
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    storageMock.getSignedUrl.mockResolvedValue("https://signed-url.example/file.pdf");

    const url = await registerDownload("td-1", { id: "student-1", role: Role.STUDENT });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(url).toBe("https://signed-url.example/file.pdf");
  });
});
