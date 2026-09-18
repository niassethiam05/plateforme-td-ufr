import { Request, Response } from "express";
import * as downloadService from "../services/download.service";
import { DownloadHistoryQuery } from "../validators/download.validators";

export async function listDownloadHistory(req: Request, res: Response) {
  const query = res.locals.query as DownloadHistoryQuery;
  res.json(await downloadService.listDownloadHistory(req.user!.id, query));
}
