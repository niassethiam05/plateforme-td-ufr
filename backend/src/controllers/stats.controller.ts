import { Request, Response } from "express";
import * as statsService from "../services/stats.service";

export async function getAdminStats(_req: Request, res: Response) {
  res.json(await statsService.getAdminStats());
}

export async function getTeacherStats(req: Request, res: Response) {
  res.json(await statsService.getTeacherStats(req.user!.id));
}
