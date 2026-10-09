import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  passwordResetToken: { updateMany: vi.fn() },
  user: { update: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  passwordResetToken: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mailMock = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn() }));
const cacheMock = vi.hoisted(() => ({ invalidateAuthUserState: vi.fn() }));

vi.mock("../../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../../config/env", () => ({ env: { clientUrl: "https://td.example" } }));
vi.mock("../../config/authStateCache", () => cacheMock);
vi.mock("../mail.service", () => mailMock);

import { requestPasswordReset, resetPassword } from "../passwordReset.service";

const activeUser = { id: "user-1", email: "etu@example.com", firstName: "Moussa", isActive: true };

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  mailMock.sendPasswordResetEmail.mockResolvedValue(undefined);
  prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);
  // Forme tableau (requestPasswordReset) ou forme fonction (resetPassword).
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof txMock) => unknown)(txMock) : arg
  );
});

describe("requestPasswordReset", () => {
  it("envoie un lien dont seule l'empreinte est stockee", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser);

    await requestPasswordReset("etu@example.com");

    expect(mailMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const { to, resetUrl } = mailMock.sendPasswordResetEmail.mock.calls[0][0];
    expect(to).toBe("etu@example.com");

    const token = new URL(resetUrl).searchParams.get("token")!;
    expect(resetUrl.startsWith("https://td.example/reinitialiser-mot-de-passe?token=")).toBe(true);

    const stored = prismaMock.passwordResetToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(sha256(token));
    expect(stored.tokenHash).not.toContain(token);
    // Les anciens liens du compte sont annules.
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("ne fait rien, sans erreur, pour une adresse inconnue", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(requestPasswordReset("inconnu@example.com")).resolves.toBeUndefined();
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("ne fait rien pour un compte inactif", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...activeUser, isActive: false });

    await requestPasswordReset("etu@example.com");
    expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("n'envoie pas un second email si un lien vient d'etre emis", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser);
    prismaMock.passwordResetToken.findFirst.mockResolvedValue({ id: "recent" });

    await requestPasswordReset("etu@example.com");
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("n'echoue pas si l'envoi de l'email echoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.user.findFirst.mockResolvedValue(activeUser);
    mailMock.sendPasswordResetEmail.mockRejectedValue(new Error("SMTP indisponible"));

    await expect(requestPasswordReset("etu@example.com")).resolves.toBeUndefined();
  });
});

describe("resetPassword", () => {
  const validToken = {
    id: "reset-1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: "user-1", isActive: true },
  };

  it("change le mot de passe, consomme le lien et ferme les sessions", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(validToken);
    txMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

    await resetPassword("jeton", "NouveauMotDePasse1");

    expect(prismaMock.passwordResetToken.findUnique.mock.calls[0][0].where).toEqual({
      tokenHash: sha256("jeton"),
    });
    const data = txMock.user.update.mock.calls[0][0].data;
    expect(data.passwordHash).not.toBe("NouveauMotDePasse1");
    expect(data.sessionVersion).toEqual({ increment: 1 });
    expect(txMock.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ userId: "user-1", revokedAt: null });
    expect(cacheMock.invalidateAuthUserState).toHaveBeenCalledWith("user-1");
  });

  it.each([
    ["inconnu", null],
    ["deja utilise", { ...validToken, usedAt: new Date() }],
    ["expire", { ...validToken, expiresAt: new Date(Date.now() - 1000) }],
    ["d'un compte desactive", { ...validToken, user: { id: "user-1", isActive: false } }],
  ])("refuse un lien %s", async (_label, stored) => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(stored);

    await expect(resetPassword("jeton", "NouveauMotDePasse1")).rejects.toThrow(/invalide ou a expiré/);
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse si le lien est consomme par une requete concurrente", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(validToken);
    txMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(resetPassword("jeton", "NouveauMotDePasse1")).rejects.toThrow(/invalide ou a expiré/);
    expect(txMock.user.update).not.toHaveBeenCalled();
  });
});
