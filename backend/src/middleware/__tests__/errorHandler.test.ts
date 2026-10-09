import { beforeEach, describe, expect, it, vi } from "vitest";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { errorHandler } from "../errorHandler";
import { AppError, NotFoundError } from "../../utils/AppError";

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function run(err: unknown) {
  const res = makeRes();
  errorHandler(err, {} as never, res as never, vi.fn());
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0] };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("erreur prisma", { code, clientVersion: "test" });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("errorHandler", () => {
  it("renvoie le statut et le message d'une AppError", () => {
    expect(run(new NotFoundError("Fiche introuvable"))).toEqual({
      status: 404,
      body: { error: "NotFoundError", message: "Fiche introuvable" },
    });
  });

  it("traduit un fichier trop volumineux en 413", () => {
    expect(run(new multer.MulterError("LIMIT_FILE_SIZE")).status).toBe(413);
  });

  it("traduit les autres erreurs Multer en 422", () => {
    expect(run(new multer.MulterError("LIMIT_UNEXPECTED_FILE")).status).toBe(422);
  });

  it("traduit un doublon Prisma (P2002) en 409", () => {
    expect(run(prismaError("P2002")).status).toBe(409);
  });

  it("traduit une cle etrangere Prisma (P2003) en 409", () => {
    expect(run(prismaError("P2003")).status).toBe(409);
  });

  it("traduit une ligne absente Prisma (P2025) en 404", () => {
    expect(run(prismaError("P2025")).status).toBe(404);
  });

  it("traduit un JSON mal forme en 400", () => {
    expect(run(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed" })).status).toBe(400);
  });

  it("garde un 500 sans detail pour une erreur inconnue", () => {
    const result = run(new Error("secret interne"));
    expect(result.status).toBe(500);
    expect(result.body.message).not.toContain("secret interne");
  });

  it("garde un 500 pour un code Prisma non prevu", () => {
    expect(run(prismaError("P1001")).status).toBe(500);
  });

  it("le refus de type de fichier est une AppError 422", () => {
    expect(run(new AppError("Le fichier de la fiche doit etre un PDF.", 422)).status).toBe(422);
  });
});
