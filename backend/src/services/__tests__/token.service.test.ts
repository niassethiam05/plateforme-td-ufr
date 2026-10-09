import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const txMock = vi.hoisted(() => ({
  refreshToken: { updateMany: vi.fn(), create: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  refreshToken: { findUnique: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../../config/env", () => ({
  env: {
    jwt: {
      accessSecret: "access-secret-de-test",
      refreshSecret: "refresh-secret-de-test",
      accessExpiresIn: "15m",
      refreshExpiresIn: "7d",
    },
  },
}));

import { isConcurrentRefresh, rotateRefreshToken } from "../token.service";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock));
});

describe("rotateRefreshToken", () => {
  it("consomme le jeton et cree son successeur dans la meme famille", async () => {
    txMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const tokens = await rotateRefreshToken("tok-1", "fam-1", "user-1", Role.STUDENT, 0);

    expect(tokens?.refreshToken).toEqual(expect.any(String));
    // La reclamation est conditionnelle : c'est elle qui departage deux
    // requetes concurrentes.
    expect(txMock.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ id: "tok-1", revokedAt: null });
    expect(txMock.refreshToken.create.mock.calls[0][0].data).toMatchObject({
      userId: "user-1",
      familyId: "fam-1",
    });
  });

  it("renvoie null sans rien creer si le jeton a deja ete consomme", async () => {
    txMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    expect(await rotateRefreshToken("tok-1", "fam-1", "user-1", Role.STUDENT, 0)).toBeNull();
    expect(txMock.refreshToken.create).not.toHaveBeenCalled();
  });
});

describe("isConcurrentRefresh", () => {
  it("tolere un jeton consomme a l'instant dont la famille est encore active", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({ revokedAt: new Date(Date.now() - 500) });
    prismaMock.refreshToken.count.mockResolvedValue(1);

    expect(await isConcurrentRefresh("tok-1", "fam-1")).toBe(true);
  });

  it("refuse un jeton consomme depuis plus de 10 s (rejeu)", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({ revokedAt: new Date(Date.now() - 11_000) });
    prismaMock.refreshToken.count.mockResolvedValue(1);

    expect(await isConcurrentRefresh("tok-1", "fam-1")).toBe(false);
  });

  it("refuse si la famille n'a plus de jeton actif (deconnexion, vol detecte)", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({ revokedAt: new Date() });
    prismaMock.refreshToken.count.mockResolvedValue(0);

    expect(await isConcurrentRefresh("tok-1", "fam-1")).toBe(false);
  });

  it("refuse un jeton inconnu", async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);

    expect(await isConcurrentRefresh("tok-1", "fam-1")).toBe(false);
  });
});
