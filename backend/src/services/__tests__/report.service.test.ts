import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/AppError";

const prismaMock = vi.hoisted(() => ({
  tdFile: { findUnique: vi.fn() },
  report: { findFirst: vi.fn(), create: vi.fn() },
  user: { findMany: vi.fn() },
}));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../storage/S3StorageProvider", () => ({ storageProvider: {} }));
vi.mock("../notification.service", () => ({
  createNotification: vi.fn(),
  createManyNotifications: vi.fn(),
}));

import { createReport } from "../report.service";
import { createNotification } from "../notification.service";

const input = { reason: "Contenu incorrect ou hors-sujet" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tdFile.findUnique.mockResolvedValue({ id: "td-1", title: "TD Test", status: "PUBLISHED" });
  prismaMock.report.findFirst.mockResolvedValue(null);
  prismaMock.report.create.mockResolvedValue({ id: "report-1" });
  prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
});

describe("report.service — createReport", () => {
  it("cree le signalement et previent les administrateurs actifs", async () => {
    await createReport("user-1", "td-1", input);

    expect(prismaMock.report.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findMany.mock.calls[0][0].where).toEqual({ role: Role.ADMIN, isActive: true });
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("refuse un second signalement tant que le premier est en attente", async () => {
    prismaMock.report.findFirst.mockResolvedValue({ id: "report-0" });

    await expect(createReport("user-1", "td-1", input)).rejects.toThrow(ConflictError);
    expect(prismaMock.report.findFirst.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      tdFileId: "td-1",
      status: "PENDING",
    });
    expect(prismaMock.report.create).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("refuse de signaler une fiche non publiee", async () => {
    prismaMock.tdFile.findUnique.mockResolvedValue({ id: "td-1", title: "TD Test", status: "DRAFT" });

    await expect(createReport("user-1", "td-1", input)).rejects.toThrow(NotFoundError);
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });
});
