import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../auth.validators";
import { changePasswordSchema } from "../profile.validators";
import { createTdFileSchema } from "../td.validators";

const validStudent = {
  email: "etudiant@ufr.sn",
  password: "MotDePasse1",
  firstName: "Awa",
  lastName: "Fall",
  role: "STUDENT",
  formationId: "11111111-1111-4111-8111-111111111111",
  levelId: "22222222-2222-4222-8222-222222222222",
};

describe("validators — email normalise", () => {
  it("l'email est ramene en minuscules et sans espaces a l'inscription", () => {
    const parsed = registerSchema.parse({ ...validStudent, email: "  Awa.Fall@UFR.sn " });
    expect(parsed.email).toBe("awa.fall@ufr.sn");
  });

  it("la connexion normalise de la meme facon", () => {
    expect(loginSchema.parse({ email: "AWA@ufr.sn", password: "x" }).email).toBe("awa@ufr.sn");
  });
});

describe("validators — mot de passe et limite de bcrypt", () => {
  it("refuse un nouveau mot de passe de plus de 72 octets", () => {
    const result = registerSchema.safeParse({ ...validStudent, password: "a".repeat(73) });
    expect(result.success).toBe(false);
  });

  it("compte en octets : 40 caracteres accentues (80 octets) sont refuses", () => {
    const result = registerSchema.safeParse({ ...validStudent, password: "é".repeat(40) });
    expect(result.success).toBe(false);
  });

  it("accepte exactement 72 octets", () => {
    expect(registerSchema.safeParse({ ...validStudent, password: "a".repeat(72) }).success).toBe(true);
  });

  it("la connexion accepte un ancien mot de passe long, cree avant la regle", () => {
    expect(loginSchema.safeParse({ email: "a@ufr.sn", password: "a".repeat(100) }).success).toBe(true);
  });

  it("le changement depuis le profil applique la meme limite au nouveau mot de passe", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "ancien", newPassword: "a".repeat(73) });
    expect(result.success).toBe(false);
  });
});

describe("validators — longueurs maximales", () => {
  const fiche = {
    title: "TD 1",
    subjectId: "11111111-1111-4111-8111-111111111111",
    academicYearId: "22222222-2222-4222-8222-222222222222",
  };

  it("refuse un titre de fiche demesure", () => {
    expect(createTdFileSchema.safeParse({ ...fiche, title: "x".repeat(201) }).success).toBe(false);
  });

  it("refuse une description de plusieurs megaoctets", () => {
    expect(createTdFileSchema.safeParse({ ...fiche, description: "x".repeat(1_000_000) }).success).toBe(false);
  });

  it("refuse un nom de plus de 100 caracteres a l'inscription", () => {
    expect(registerSchema.safeParse({ ...validStudent, lastName: "x".repeat(101) }).success).toBe(false);
  });

  it("un titre fait d'espaces seulement est refuse", () => {
    expect(createTdFileSchema.safeParse({ ...fiche, title: "   " }).success).toBe(false);
  });
});
