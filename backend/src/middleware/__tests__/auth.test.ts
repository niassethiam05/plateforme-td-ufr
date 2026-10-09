import { describe, expect, it, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { registerSchema } from "../../validators/auth.validators";

// getAuthUserState est interroge par requireAuth pour relire l'etat du compte
// en base ; on le mocke pour tester la logique du middleware isolement.
const authStateMock = vi.hoisted(() => ({
  getAuthUserState: vi.fn(),
  invalidateAuthUserState: vi.fn(),
}));

vi.mock("../../config/authStateCache", () => authStateMock);
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

import { requireAuth, optionalAuth } from "../auth";
import { signAccessToken, signFileToken } from "../../utils/jwt";

type Middleware = (req: unknown, res: unknown, next: (arg?: unknown) => void) => void | Promise<void>;

function makeReq(authorization?: string) {
  return { headers: { authorization } } as never;
}
function makeRes() {
  return {} as never;
}

/**
 * requireAuth ne leve pas ses erreurs : il les transmet a next() (signature
 * Express). On capture donc l'argument recu par next plutot que d'attendre un
 * rejet de promesse.
 */
async function runAndCaptureError(req: unknown, middleware: Middleware) {
  let captured: unknown;
  let called = false;
  await middleware(req, makeRes(), (arg?: unknown) => {
    called = true;
    captured = arg;
  });
  expect(called).toBe(true);
  return captured;
}

function statusOf(error: unknown): number | undefined {
  return (error as { statusCode?: number }).statusCode;
}

describe("registerSchema", () => {
  const valid = {
    email: "etudiant@ufr-td.sn",
    password: "motdepasse123",
    firstName: "Moussa",
    lastName: "Fall",
    formationId: "3f1a0c22-1c4e-4f7a-9d2b-8a5e1c0d7b11",
    levelId: "9c2b4d18-6e3a-4b5c-8d1f-2a7e6b3c9d44",
  };

  it("accepte une inscription etudiante sans champ role", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    // role est materialise par le default : le service peut le lire sans
    // se soucier de sa presence.
    if (result.success) expect(result.data.role).toBe("STUDENT");
  });

  // Regression: role was a free enum including ADMIN, so anyone could
  // POST role:"ADMIN" and self-promote.
  it("refuse role=ADMIN", () => {
    const result = registerSchema.safeParse({ ...valid, role: "ADMIN" });
    expect(result.success).toBe(false);
  });

  it("accepte role=TEACHER sans formation ni niveau", () => {
    const result = registerSchema.safeParse({
      email: "prof.nouveau@ufr-td.sn",
      password: "motdepasse123",
      firstName: "Awa",
      lastName: "Sarr",
      role: "TEACHER",
    });
    expect(result.success).toBe(true);
  });

  // Regression: le formulaire n'affiche pas formation/niveau pour un
  // enseignant, mais envoie quand meme les champs a "". `optional()` seul ne
  // suffisait pas : "" est une valeur presente, invalide comme UUID.
  it("accepte role=TEACHER avec formationId et levelId vides", () => {
    const result = registerSchema.safeParse({
      email: "prof.vide@ufr-td.sn",
      password: "motdepasse123",
      firstName: "Awa",
      lastName: "Sarr",
      role: "TEACHER",
      formationId: "",
      levelId: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.formationId).toBeUndefined();
  });

  it("exige toujours une vraie formation pour un etudiant", () => {
    const result = registerSchema.safeParse({ ...valid, formationId: "" });
    expect(result.success).toBe(false);
  });

  it("exige formationId et levelId pour un etudiant", () => {
    const { formationId, levelId, ...withoutFormation } = valid;
    void formationId;
    void levelId;
    expect(registerSchema.safeParse(withoutFormation).success).toBe(false);

    const { levelId: _drop, ...withoutLevel } = valid;
    expect(registerSchema.safeParse(withoutLevel).success).toBe(false);
  });

  it("refuse des identifiants de formation/niveau non-UUID", () => {
    expect(registerSchema.safeParse({ ...valid, formationId: "MIO" }).success).toBe(false);
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.TEACHER,
      isActive: true,
      sessionVersion: 3,
    });
  });

  it("accepte un token valide dont la version de session correspond", async () => {
    const token = signAccessToken({ sub: "user-1", role: Role.TEACHER, sv: 3 });
    const req = makeReq(`Bearer ${token}`);
    await requireAuth(req, makeRes(), () => undefined);
    // En cas de succes, next() est appele SANS argument : l'identification
    // se fait par req.user, pas par la valeur transmise a next.
    expect((req as { user?: unknown }).user).toEqual({
      id: "user-1",
      role: Role.TEACHER,
      sv: 3,
    });
  });

  it("refuse un compte desactive meme si le token est encore dans sa duree de vie", async () => {
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.TEACHER,
      isActive: false,
      sessionVersion: 3,
    });
    const token = signAccessToken({ sub: "user-1", role: Role.TEACHER, sv: 3 });
    const err = await runAndCaptureError(makeReq(`Bearer ${token}`), requireAuth);
    expect(statusOf(err)).toBe(401);
  });

  it("refuse un token dont la version de session ne correspond plus (session revoquee)", async () => {
    const token = signAccessToken({ sub: "user-1", role: Role.TEACHER, sv: 3 });
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.TEACHER,
      isActive: true,
      sessionVersion: 4, // incrementee par un changement de mdp / desactivation
    });
    const err = await runAndCaptureError(makeReq(`Bearer ${token}`), requireAuth);
    expect(statusOf(err)).toBe(401);
  });

  it("utilise le role de la base, pas la claim du token", async () => {
    // Token emis quand l'utilisateur etait ADMIN, role retrograde en base depuis.
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.STUDENT,
      isActive: true,
      sessionVersion: 3,
    });
    const token = signAccessToken({ sub: "user-1", role: Role.ADMIN, sv: 3 });
    const req = makeReq(`Bearer ${token}`);
    await requireAuth(req, makeRes(), () => undefined);
    expect((req as { user?: unknown }).user).toEqual({
      id: "user-1",
      role: Role.STUDENT,
      sv: 3,
    });
  });

  // Regression de securite : un jeton de fichier (emis pour servir un PDF via
  // une URL relative, avec la meme cle d'acces) ne doit pas passer pour un
  // access token. Sinon, partager le lien d'une fiche revient a partager une
  // session, pendant les 120 s de vie du jeton.
  it("refuse un jeton de fichier comme jeton d'acces", async () => {
    const fileToken = signFileToken({
      sub: "user-1",
      sv: 3,
      tdId: "td-1",
      scope: "view",
      purpose: "file",
    });
    const err = await runAndCaptureError(makeReq(`Bearer ${fileToken}`), requireAuth);
    expect(statusOf(err)).toBe(401);
    // Et l'etat du compte n'est meme pas interroge.
    expect(authStateMock.getAuthUserState).not.toHaveBeenCalled();
  });

  it("ne reconnait pas un compte via un jeton de fichier (optionalAuth)", async () => {
    const fileToken = signFileToken({
      sub: "user-1",
      sv: 3,
      tdId: "td-1",
      scope: "view",
      purpose: "file",
    });
    const req = makeReq(`Bearer ${fileToken}`);
    let error: unknown;
    await optionalAuth(req, makeRes(), (e?: unknown) => {
      error = e;
    });
    expect(error).toBeUndefined();
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(authStateMock.getAuthUserState).not.toHaveBeenCalled();
  });

  it("aligne sur 0 un token emis avant l'introduction de sessionVersion", async () => {
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.STUDENT,
      isActive: true,
      sessionVersion: 0,
    });
    const token = signAccessToken({ sub: "user-1", role: Role.STUDENT });
    const req = makeReq(`Bearer ${token}`);
    let error: unknown;
    await requireAuth(req, makeRes(), (e?: unknown) => {
      error = e;
    });
    expect(error).toBeUndefined();
  });

  it("refuse une requete sans en-tete Authorization", async () => {
    const err = await runAndCaptureError(makeReq(), requireAuth);
    expect(statusOf(err)).toBe(401);
  });

  it("refuse un token signe avec la mauvaise cle", async () => {
    const err = await runAndCaptureError(makeReq("Bearer invalide.signature"), requireAuth);
    expect(statusOf(err)).toBe(401);
  });
});

describe("optionalAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("laisse passer la requete sans token, comme un visiteur anonyme", async () => {
    const req = makeReq();
    let error: unknown;
    await optionalAuth(req, makeRes(), (e?: unknown) => {
      error = e;
    });
    expect(error).toBeUndefined();
    expect((req as { user?: unknown }).user).toBeUndefined();
  });

  it("attache l'utilisateur pour un token valide", async () => {
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.TEACHER,
      isActive: true,
      sessionVersion: 0,
    });
    const token = signAccessToken({ sub: "user-1", role: Role.TEACHER });
    const req = makeReq(`Bearer ${token}`);
    await optionalAuth(req, makeRes(), () => undefined);
    expect((req as { user?: unknown }).user).toEqual({ id: "user-1", role: Role.TEACHER });
  });

  // Sur une route publique, un compte desactive doit se comporter comme un
  // visiteur : plus de reconnaissance d'identite, mais pas de 401.
  it("traite un compte desactive comme un visiteur anonyme", async () => {
    authStateMock.getAuthUserState.mockResolvedValue({
      userId: "user-1",
      role: Role.TEACHER,
      isActive: false,
      sessionVersion: 0,
    });
    const token = signAccessToken({ sub: "user-1", role: Role.TEACHER });
    const req = makeReq(`Bearer ${token}`);
    let error: unknown;
    await optionalAuth(req, makeRes(), (e?: unknown) => {
      error = e;
    });
    expect(error).toBeUndefined();
    expect((req as { user?: unknown }).user).toBeUndefined();
  });
});