import { Request, Response } from "express";
import * as levelService from "../services/level.service";

export async function listLevels(req: Request, res: Response) {
  const formationId = typeof req.query.formationId === "string" ? req.query.formationId : undefined;
  res.json(await levelService.listLevels(formationId));
}

export async function getLevel(req: Request, res: Response) {
  res.json(await levelService.getLevel(req.params.id));
}

export async function createLevel(req: Request, res: Response) {
  res.status(201).json(await levelService.createLevel(req.body));
}

export async function updateLevel(req: Request, res: Response) {
  res.json(await levelService.updateLevel(req.params.id, req.body));
}

export async function deleteLevel(req: Request, res: Response) {
  await levelService.deleteLevel(req.params.id);
  res.status(204).send();
}
