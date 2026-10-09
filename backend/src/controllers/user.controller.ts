import { Request, Response } from "express";
import type { Role } from "@prisma/client";
import * as userService from "../services/user.service";

export async function listUsers(req: Request, res: Response) {
  const filter = (res.locals.query as { role?: Role | "PENDING" } | undefined)?.role;
  res.json(await userService.listUsers(filter));
}

export async function setUserActive(req: Request, res: Response) {
  const { isActive } = req.body as { isActive: boolean };
  // req.user est pose par requireAuth : l'identifiant de l'appelant est
  // compare a la cible pour interdire a un admin de se desactiver lui-meme
  // (il se verrouillerait hors de la plateforme sans rien pouvoir annuler).
  res.json(await userService.setUserActive(req.params.id, isActive, req.user!.id));
}