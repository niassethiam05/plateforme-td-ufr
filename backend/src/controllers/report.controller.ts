import { Request, Response } from "express";
import * as reportService from "../services/report.service";
import { CreateReportInput, ReportQuery, ResolveReportInput } from "../validators/report.validators";

export async function createReport(req: Request, res: Response) {
  const input = req.body as CreateReportInput;
  const report = await reportService.createReport(req.user!.id, req.params.tdFileId, input);
  res.status(201).json(report);
}

export async function listReports(req: Request, res: Response) {
  const query = res.locals.query as ReportQuery;
  res.json(await reportService.listReports(query));
}

export async function resolveReport(req: Request, res: Response) {
  const { status } = req.body as ResolveReportInput;
  res.json(await reportService.resolveReport(req.params.id, status));
}
