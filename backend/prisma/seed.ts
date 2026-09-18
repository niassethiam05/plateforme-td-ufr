/**
 * Donnees de demonstration pour que la plateforme soit utilisable
 * immediatement apres l'installation : un administrateur, un enseignant,
 * un etudiant, une formation avec sa hierarchie complete, et quelques
 * fiches de TD deja publiees.
 *
 * Execution : npm run prisma:seed --workspace backend
 * (necessite que `prisma generate` et `prisma migrate dev` aient deja ete
 * executes, et que MinIO/PostgreSQL tournent — voir docker-compose.yml).
 */
import "../src/config/env";
import bcrypt from "bcryptjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../src/config/prisma";
import { storageProvider } from "../src/services/storage/S3StorageProvider";

const DEMO_PASSWORD = "Demo1234!";

async function buildDemoPdf(title: string, lines: string[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(title, { x: 50, y: 780, size: 20, font: bold, color: rgb(0.1, 0.1, 0.4) });
  page.drawText("UFR — Plateforme de fiches de TD (document de démonstration)", {
    x: 50,
    y: 755,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  let y = 700;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 24;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function main() {
  console.log("Démarrage du seed...");

  // --- Années universitaires -------------------------------------------
  const previousYear = await prisma.academicYear.upsert({
    where: { label: "2025-2026" },
    update: {},
    create: {
      label: "2025-2026",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: false,
    },
  });

  const currentYear = await prisma.academicYear.upsert({
    where: { label: "2026-2027" },
    update: { isCurrent: true },
    create: {
      label: "2026-2027",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2027-07-31"),
      isCurrent: true,
    },
  });

  // --- Comptes utilisateurs ----------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ufr-td.sn" },
    update: {},
    create: {
      email: "admin@ufr-td.sn",
      passwordHash,
      firstName: "Admin",
      lastName: "Plateforme",
      role: "ADMIN",
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "prof.diallo@ufr-td.sn" },
    update: {},
    create: {
      email: "prof.diallo@ufr-td.sn",
      passwordHash,
      firstName: "Fatou",
      lastName: "Diallo",
      role: "TEACHER",
      teacher: { create: { department: "Informatique de gestion" } },
    },
    include: { teacher: true },
  });
  const teacher = teacherUser.teacher!;

  // --- Formation / niveaux / semestres / matieres -------------------------
  const formation = await prisma.formation.upsert({
    where: { code: "MIO" },
    update: {},
    create: {
      code: "MIO",
      name: "Management Informatisé des Organisations",
      description:
        "Formation dédiée aux systèmes d'information et à la gestion informatisée des organisations.",
    },
  });

  const levelNames: Array<{ name: string; order: number }> = [
    { name: "L1", order: 1 },
    { name: "L2", order: 2 },
    { name: "L3", order: 3 },
  ];

  const levels: Record<string, Awaited<ReturnType<typeof prisma.level.upsert>>> = {};
  for (const lvl of levelNames) {
    levels[lvl.name] = await prisma.level.upsert({
      where: { formationId_name: { formationId: formation.id, name: lvl.name } },
      update: {},
      create: { formationId: formation.id, name: lvl.name, order: lvl.order },
    });
  }

  const semesterKeys = ["S1", "S2"];
  const semesters: Record<string, Awaited<ReturnType<typeof prisma.semester.upsert>>> = {};
  for (const lvl of levelNames) {
    for (const [idx, sem] of semesterKeys.entries()) {
      const key = `${lvl.name}-${sem}`;
      semesters[key] = await prisma.semester.upsert({
        where: {
          levelId_academicYearId_name: {
            levelId: levels[lvl.name].id,
            academicYearId: currentYear.id,
            name: sem,
          },
        },
        update: {},
        create: {
          levelId: levels[lvl.name].id,
          academicYearId: currentYear.id,
          name: sem,
          order: idx + 1,
        },
      });
    }
  }

  const dbSubject = await prisma.subject.findFirst({
    where: { semesterId: semesters["L2-S2"].id, name: "Base de données" },
  });
  const subjectDb =
    dbSubject ??
    (await prisma.subject.create({
      data: {
        semesterId: semesters["L2-S2"].id,
        name: "Base de données",
        code: "MIO-L2-BDD",
        mainTeacherId: teacher.id,
        description: "Modélisation, SQL, jointures, normalisation.",
      },
    }));

  const algoSubject = await prisma.subject.findFirst({
    where: { semesterId: semesters["L1-S1"].id, name: "Algorithmique" },
  });
  const subjectAlgo =
    algoSubject ??
    (await prisma.subject.create({
      data: {
        semesterId: semesters["L1-S1"].id,
        name: "Algorithmique",
        code: "MIO-L1-ALGO",
        mainTeacherId: teacher.id,
        description: "Bases de l'algorithmique et structures de données.",
      },
    }));

  // --- Compte etudiant (rattache a MIO / L2) -----------------------------
  await prisma.user.upsert({
    where: { email: "etudiant.fall@ufr-td.sn" },
    update: {},
    create: {
      email: "etudiant.fall@ufr-td.sn",
      passwordHash,
      firstName: "Moussa",
      lastName: "Fall",
      role: "STUDENT",
      student: {
        create: { formationId: formation.id, levelId: levels["L2"].id, studentNumber: "MIO2027-014" },
      },
    },
  });

  // --- Fiches de TD de demonstration (avec vrai PDF dans MinIO) ----------
  const existingTdCount = await prisma.tdFile.count({ where: { teacherId: teacher.id } });
  if (existingTdCount === 0) {
    const demoFiles = [
      {
        subjectId: subjectDb.id,
        title: "TD 01 — Modélisation entité-association",
        description: "Exercices de modélisation conceptuelle de données (MCD).",
        tdNumber: 1,
        lines: ["Exercice 1 : modéliser une bibliothèque", "Exercice 2 : modéliser une pharmacie"],
      },
      {
        subjectId: subjectDb.id,
        title: "TD 03 — Jointures SQL",
        description: "Requêtes SQL avec jointures internes et externes.",
        tdNumber: 3,
        lines: ["Exercice 1 : INNER JOIN", "Exercice 2 : LEFT JOIN", "Exercice 3 : sous-requêtes"],
      },
      {
        subjectId: subjectAlgo.id,
        title: "TD 01 — Structures de contrôle",
        description: "Boucles, conditions, premiers algorithmes.",
        tdNumber: 1,
        lines: ["Exercice 1 : boucle for", "Exercice 2 : recherche dans un tableau"],
      },
    ];

    for (const demo of demoFiles) {
      try {
        const pdfBuffer = await buildDemoPdf(demo.title, demo.lines);
        const key = `td-files/${demo.subjectId}/seed-${Date.now()}-${demo.tdNumber}.pdf`;
        const upload = await storageProvider.upload({
          buffer: pdfBuffer,
          key,
          contentType: "application/pdf",
        });

        await prisma.tdFile.create({
          data: {
            subjectId: demo.subjectId,
            teacherId: teacher.id,
            academicYearId: currentYear.id,
            title: demo.title,
            description: demo.description,
            tdNumber: demo.tdNumber,
            fileKey: upload.key,
            fileSize: upload.size,
            fileType: upload.contentType,
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });
        console.log(`  ✓ Fiche créée et téléversée : ${demo.title}`);
      } catch (err) {
        console.warn(
          `  ! Impossible de téléverser "${demo.title}" (MinIO est-il démarré ? "docker compose up -d") :`,
          (err as Error).message
        );
      }
    }
  }

  console.log("\nSeed terminé. Comptes de démonstration (mot de passe commun) :");
  console.table([
    { role: "ADMIN", email: "admin@ufr-td.sn", password: DEMO_PASSWORD },
    { role: "TEACHER", email: "prof.diallo@ufr-td.sn", password: DEMO_PASSWORD },
    { role: "STUDENT", email: "etudiant.fall@ufr-td.sn", password: DEMO_PASSWORD },
  ]);
}

main()
  .catch((err) => {
    console.error("Erreur pendant le seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
