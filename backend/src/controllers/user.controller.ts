import { Request, Response } from "express";
import { Role } from "@prisma/client";
import * as userService from "../services/user.service";

export async function listUsers(req: Request, res: Response) {
  const role = typeof req.query.role === "string" ? (req.query.role as Role) : undefined;
  res.json(await userService.listUsers(role));
}

export async function setUserActive(req: Request, res: Response) {
  const { isActive } = req.body as { isActive: boolean };
  res.json(await userService.setUserActive(req.params.id, isActive));
}
