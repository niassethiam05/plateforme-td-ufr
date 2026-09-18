import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function getHealth(_req: Request, res: Response) {
  let databaseStatus: "ok" | "erreur" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "erreur";
  }

  res.json({
    status: "ok",
    service: "plateforme-td-ufr-backend",
    database: databaseStatus,
    timestamp: new Date().toISOString(),
  });
}
