import { Request, Response } from "express";
import * as service from "../services/semester.service";

function strParam(v: unknown) {
  return typeof v === "string" ? v : undefined;
}

export async function listSemesters(req: Request, res: Response) {
  res.json(await service.listSemesters(strParam(req.query.levelId), strParam(req.query.academicYearId)));
}

export async function getSemester(req: Request, res: Response) {
  res.json(await service.getSemester(req.params.id));
}

export async function createSemester(req: Request, res: Response) {
  res.status(201).json(await service.createSemester(req.body));
}

export async function updateSemester(req: Request, res: Response) {
  res.json(await service.updateSemester(req.params.id, req.body));
}

export async function deleteSemester(req: Request, res: Response) {
  await service.deleteSemester(req.params.id);
  res.status(204).send();
}
