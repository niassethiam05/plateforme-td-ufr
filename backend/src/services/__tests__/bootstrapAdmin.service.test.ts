import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  user: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));

const envMock = vi.hoisted(() => ({
  env: { bootstrapAdmin: { email: undefined as string | undefined, password: undefined as string | undefined } },
}));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../../config/env", () => envMock);

import { bootstrapAdmin } from "../bootstrapAdmin.service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  envMock.env.bootstrapAdmin = { email: "admin@example.com", password: "un-mot-de-passe-long" };
  prismaMock.user.count.mockResolvedValue(0);
  prismaMock.user.findFirst.mockResolvedValue(null);
});

describe("bootstrapAdmin", () => {
  it("cree l'administrateur avec un mot de passe hache", async () => {
    expect(await bootstrapAdmin()).toBe("created");

    const data = prismaMock.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "admin@example.com", role: Role.ADMIN });
    expect(data.passwordHash).not.toBe("un-mot-de-passe-long");
  });

  it("ne fait rien sans ADMIN_EMAIL ou ADMIN_PASSWORD", async () => {
    envMock.env.bootstrapAdmin = { email: "admin@example.com", password: undefined };

    expect(await bootstrapAdmin()).toBe("skipped-not-configured");
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it("ne fait rien si un administrateur existe deja", async () => {
    prismaMock.user.count.mockResolvedValue(1);

    expect(await bootstrapAdmin()).toBe("skipped-admin-exists");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe de moins de 12 caracteres", async () => {
    envMock.env.bootstrapAdmin = { email: "admin@example.com", password: "trop-court" };

    expect(await bootstrapAdmin()).toBe("skipped-invalid");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("refuse une adresse email invalide", async () => {
    envMock.env.bootstrapAdmin = { email: "pas-une-adresse", password: "un-mot-de-passe-long" };

    expect(await bootstrapAdmin()).toBe("skipped-invalid");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("ne promeut pas un compte existant qui porte la meme adresse", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-1" });

    expect(await bootstrapAdmin()).toBe("skipped-invalid");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
