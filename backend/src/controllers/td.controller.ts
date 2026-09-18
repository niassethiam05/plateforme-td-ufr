import { Request, Response } from "express";
import * as tdService from "../services/td.service";
import { AppError, NotFoundError } from "../utils/AppError";
import { isImageBuffer, isPdfBuffer } from "../utils/fileSignature";
import { TdFileQuery } from "../validators/td.validators";

type MulterFiles = { [fieldname: string]: Express.Multer.File[] } | undefined;

export async function listTdFiles(req: Request, res: Response) {
  const query = res.locals.query as TdFileQuery;
  res.json(await tdService.listTdFiles(query, req.user));
}

export async function getTdFile(req: Request, res: Response) {
  res.json(await tdService.getTdFileOrThrow(req.params.id, req.user));
}

export async function createTdFile(req: Request, res: Response) {
  const files = req.files as MulterFiles;
  const pdf = files?.file?.[0];
  if (!pdf) {
    throw new AppError("Le fichier PDF de la fiche est requis", 422);
  }
  if (!isPdfBuffer(pdf.buffer)) {
    throw new AppError("Le fichier fourni n'est pas un PDF valide", 422);
  }

  const coverImage = files?.coverImage?.[0];
  if (coverImage && !isImageBuffer(coverImage.buffer)) {
    throw new AppError("L'image de couverture fournie n'est pas valide", 422);
  }

  const tdFile = await tdService.createTdFile(req.user!.id, req.body, {
    file: { buffer: pdf.buffer, mimetype: pdf.mimetype, size: pdf.size },
    coverImage: coverImage
      ? { buffer: coverImage.buffer, mimetype: coverImage.mimetype, size: coverImage.size }
      : undefined,
  });

  res.status(201).json(tdFile);
}

export async function updateTdFile(req: Request, res: Response) {
  const tdFile = await tdService.updateTdFile(req.params.id, req.user!, req.body);
  res.json(tdFile);
}

export async function replaceTdFilePdf(req: Request, res: Response) {
  const files = req.files as MulterFiles;
  const pdf = files?.file?.[0];
  if (!pdf || !isPdfBuffer(pdf.buffer)) {
    throw new AppError("Un fichier PDF valide est requis", 422);
  }
  const tdFile = await tdService.replaceTdFilePdf(req.params.id, req.user!, {
    buffer: pdf.buffer,
    mimetype: pdf.mimetype,
    size: pdf.size,
  });
  res.json(tdFile);
}

export async function deleteTdFile(req: Request, res: Response) {
  await tdService.deleteTdFile(req.params.id, req.user!);
  res.status(204).send();
}

export async function submitTdFile(req: Request, res: Response) {
  res.json(await tdService.submitTdFile(req.params.id, req.user!));
}

export async function decideTdFile(req: Request, res: Response) {
  const { approve, adminComment } = req.body as { approve: boolean; adminComment?: string };
  res.json(await tdService.decideTdFile(req.params.id, approve, adminComment));
}

export async function downloadTdFile(req: Request, res: Response) {
  if (!req.user) throw new NotFoundError("Fiche introuvable");
  const url = await tdService.registerDownload(req.params.id, req.user);
  res.json({ url });
}

export async function viewTdFile(req: Request, res: Response) {
  const url = await tdService.registerView(req.params.id, req.user);
  res.json({ url });
}
