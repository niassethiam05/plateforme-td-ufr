import { Request, Response } from "express";
import * as formationService from "../services/formation.service";

export async function listFormations(_req: Request, res: Response) {
  res.json(await formationService.listFormations());
}

export async function getFormation(req: Request, res: Response) {
  res.json(await formationService.getFormation(req.params.id));
}

export async function createFormation(req: Request, res: Response) {
  const formation = await formationService.createFormation(req.body);
  res.status(201).json(formation);
}

export async function updateFormation(req: Request, res: Response) {
  res.json(await formationService.updateFormation(req.params.id, req.body));
}

export async function deleteFormation(req: Request, res: Response) {
  await formationService.deleteFormation(req.params.id);
  res.status(204).send();
}
