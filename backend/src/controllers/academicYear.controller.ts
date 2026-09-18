import { Request, Response } from "express";
import * as service from "../services/academicYear.service";

export async function listAcademicYears(_req: Request, res: Response) {
  res.json(await service.listAcademicYears());
}

export async function getAcademicYear(req: Request, res: Response) {
  res.json(await service.getAcademicYear(req.params.id));
}

export async function createAcademicYear(req: Request, res: Response) {
  res.status(201).json(await service.createAcademicYear(req.body));
}

export async function updateAcademicYear(req: Request, res: Response) {
  res.json(await service.updateAcademicYear(req.params.id, req.body));
}

export async function deleteAcademicYear(req: Request, res: Response) {
  await service.deleteAcademicYear(req.params.id);
  res.status(204).send();
}
