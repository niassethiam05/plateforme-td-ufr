import { describe, expect, it, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../token.service", () => ({ revokeAllForUser: vi.fn() }));
vi.mock("../../config/authStateCache", () => ({ invalidateAuthUserState: vi.fn() }));

import { listUsers, setUserActive } from "../user.service";

describe("listUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  it("filtre les comptes en attente de validation en base", async () => {
    await listUsers("PENDING");

    // Le filtre doit atteindre Prisma : un filtrage cote client chargerait
    // toute la base a chaque affichage de la liste admin. Le role en fait
    // partie : sans lui, un etudiant desactive (teacherApprovedAt toujours
    // null) serait liste comme enseignant a valider.
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: Role.TEACHER, isActive: false, teacherApprovedAt: null },
      })
    );
  });

  it("filtre par role quand un role est fourni", async () => {
    await listUsers(Role.TEACHER);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: Role.TEACHER } })
    );
  });

  it("ne filtre rien sans parametre", async () => {
    await listUsers(undefined);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });
});

describe("setUserActive — garde-fous administrateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse l'auto-desactivation d'un admin", async () => {
    // Un admin qui se desactive lui-meme se verrouille dehors : plus personne
    // ne peut se connecter pour le reactiver.
    await expect(setUserActive("admin-1", false, "admin-1")).rejects.toThrow(
      /votre propre compte/i
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse de desactiver le dernier administrateur actif", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: Role.ADMIN });
    prismaMock.user.count.mockResolvedValue(1);

    await expect(setUserActive("admin-2", false, "admin-1")).rejects.toThrow(
      /dernier administrateur/i
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("autorise la desactivation d'un admin s'il en reste un autre actif", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: Role.ADMIN });
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.update.mockResolvedValue({ id: "admin-2" });

    await expect(setUserActive("admin-2", false, "admin-1")).resolves.toEqual({ id: "admin-2" });
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  it("laisse desactiver un etudiant sans contrainte", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "etu-1", role: Role.STUDENT });
    prismaMock.user.update.mockResolvedValue({ id: "etu-1" });

    await expect(setUserActive("etu-1", false, "admin-1")).resolves.toEqual({ id: "etu-1" });
  });

  it("horodate la premiere validation d'un enseignant", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "prof-1",
      role: Role.TEACHER,
      teacherApprovedAt: null,
    });
    prismaMock.user.update.mockResolvedValue({ id: "prof-1" });

    await setUserActive("prof-1", true, "admin-1");

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: true, teacherApprovedAt: expect.any(Date) }),
      })
    );
  });

  it("ne reecrase pas la date de validation a la reactivation", async () => {
    const approvedAt = new Date("2026-01-01T00:00:00Z");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "prof-1",
      role: Role.TEACHER,
      teacherApprovedAt: approvedAt,
    });
    prismaMock.user.update.mockResolvedValue({ id: "prof-1" });

    await setUserActive("prof-1", true, "admin-1");

    const data = prismaMock.user.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("teacherApprovedAt");
  });

  it("incremente sessionVersion a la desactivation", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "etu-1",
      role: Role.STUDENT,
      teacherApprovedAt: null,
    });
    prismaMock.user.update.mockResolvedValue({ id: "etu-1" });

    await setUserActive("etu-1", false, "admin-1");

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionVersion: { increment: 1 } }) })
    );
  });
});