/**
 * Comptes etudiants pour le test de charge (voir loadtest/README.md).
 *
 * Chaque utilisateur virtuel de k6 se connecte avec son propre compte, comme
 * de vrais etudiants : les limites de debit comptent par compte, et un seul
 * compte partage par tous serait bloque en quelques secondes.
 *
 * Execution : npm run loadtest:users --workspace backend [-- nombre]
 *
 * Refuse de tourner sur une autre base que la base locale : ces comptes n'ont
 * rien a faire en production.
 */
import "../src/config/env";
import bcrypt from "bcryptjs";
import { Role, TdFileStatus } from "@prisma/client";
import { prisma } from "../src/config/prisma";

export const LOADTEST_PASSWORD = "Charge1234!";
const DEFAULT_COUNT = 300;

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^:/?]+)/)?.[1];
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Base "${host ?? "inconnue"}" : ce script ne tourne que sur la base locale.`);
  }
}

async function main() {
  assertLocalDatabase();
  const count = Number(process.argv[2] ?? DEFAULT_COUNT);

  // Les comptes sont rattaches a la filiere d'une fiche publiee, pour que le
  // catalogue de chaque etudiant virtuel ne soit pas vide.
  const tdFile = await prisma.tdFile.findFirst({
    where: { status: TdFileStatus.PUBLISHED },
    include: { subject: { include: { semester: { include: { level: true } } } } },
  });
  if (!tdFile) throw new Error("Aucune fiche publiee : lancez d'abord le seed de demonstration.");
  const level = tdFile.subject.semester.level;

  // Un seul hachage pour tous : bcrypt coute cher, et le mot de passe est le meme.
  const passwordHash = await bcrypt.hash(LOADTEST_PASSWORD, 12);

  let created = 0;
  for (let i = 1; i <= count; i++) {
    const email = `charge.etudiant${i}@ufr-td.test`;
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) continue;
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: "Charge",
        lastName: `Etudiant ${i}`,
        role: Role.STUDENT,
        student: { create: { formationId: level.formationId, levelId: level.id } },
      },
    });
    created++;
  }

  console.log(`${created} compte(s) cree(s), ${count - created} deja present(s).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
