import { Request, Response } from "express";
import * as service from "../services/subject.service";

export async function listSubjects(req: Request, res: Response) {
  const semesterId = typeof req.query.semesterId === "string" ? req.query.semesterId : undefined;
  res.json(await service.listSubjects(semesterId));
}

export async function getSubject(req: Request, res: Response) {
  res.json(await service.getSubject(req.params.id));
}

export async function createSubject(req: Request, res: Response) {
  res.status(201).json(await service.createSubject(req.body));
}

export async function updateSubject(req: Request, res: Response) {
  res.json(await service.updateSubject(req.params.id, req.body));
}

export async function deleteSubject(req: Request, res: Response) {
  await service.deleteSubject(req.params.id);
  res.status(204).send();
}
