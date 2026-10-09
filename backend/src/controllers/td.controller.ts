import { Request, Response } from "express";
import { Role } from "@prisma/client";
import * as tdService from "../services/td.service";
import { storageProvider } from "../services/storage/S3StorageProvider";
import { AppError, NotFoundError, UnauthorizedError } from "../utils/AppError";
import { isImageBuffer, isPdfBuffer } from "../utils/fileSignature";
import { signFileToken, verifyFileToken } from "../utils/jwt";
import { getAuthUserState } from "../config/authStateCache";
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

/**
 * Route "issue" : repond par une URL relative + un jeton de portee restreinte.
 *
 * Le navigateur ne peut pas presenter l'en-tete Authorization a une requete
 * subie (`<iframe src>`, `window.open`) : la consultation PDF ne passe donc
 * pas par les routes classes d'API, mais par des routes de flux (ci-dessous),
 * identifiees par un jeton de fichier emis ici. Ce jeton :
 *  - porte `purpose: "file"` et n'est donc jamais accepte comme jeton d'acces ;
 *  - expire en 120 s (le temps de charger la page, pas celui de partager l'URL) ;
 *  - porte tdId + session version, qui sont re-verifies a chaque requete de flux.
 *
 * L'URL est relative (meme origine) : aucun nom d'hote de stockage n'est
 * jamais expose au client, et la meme origine permet un CSP `frame-src 'self'`.
 */
function respondWithFileUrl(res: Response, tdId: string, req: Request, scope: "view" | "download") {
  if (!req.user) throw new NotFoundError("Fiche introuvable");

  const token = signFileToken({
    sub: req.user.id,
    sv: req.user.sv ?? 0,
    tdId,
    scope,
    purpose: "file",
  });

  res.json({ url: `/api/td/${tdId}/file/${scope}`, token, expiresInSeconds: 120 });
}

export async function downloadTdFile(req: Request, res: Response) {
  await tdService.prepareDownload(req.params.id, req.user!);
  respondWithFileUrl(res, req.params.id, req, "download");
}

export async function viewTdFile(req: Request, res: Response) {
  await tdService.prepareView(req.params.id, req.user);
  respondWithFileUrl(res, req.params.id, req, "view");
}

/**
 * Route "flux" : pas d'en-tete Authorization, le jeton est dans la query
 * string. Le serveur re-verifie le jeton, le compte, la session et la
 * visibilite de la fiche A CE MOMENT, puis stream le PDF depuis le stockage.
 *
 * Toutes les verifications et tous les headers sont poses avant d'envoyer le
 * premier octet : une erreur survenue en cours de flux ne peut plus etre
 * traduite en code HTTP, donc elle ne doit pas survenir ici.
 */
export async function streamTdFile(req: Request, res: Response) {
  const rawToken = req.query.token;
  if (typeof rawToken !== "string" || !rawToken) {
    throw new UnauthorizedError("Jeton de fichier manquant");
  }

  let payload;
  try {
    payload = verifyFileToken(rawToken);
  } catch {
    throw new UnauthorizedError("Jeton de fichier invalide ou expire");
  }

  // Le jeton a ete emis pour une fiche precise : il ne peut pas ouvrir une
  // autre. Le `sub` (compte) et le `sv` (session) sont re-verifies en base.
  if (payload.tdId !== req.params.id) {
    throw new UnauthorizedError("Jeton de fichier invalide ou expire");
  }

  const state = await getAuthUserState(payload.sub);
  if (!state.isActive) {
    throw new UnauthorizedError("Compte desactive");
  }
  if ((payload.sv ?? 0) !== state.sessionVersion) {
    throw new UnauthorizedError("Session invalidee, veuillez vous reconnecter");
  }
  const requester = { id: state.userId, role: state.role as Role };

  const isDownload = payload.scope === "download";
  const target = isDownload
    ? await tdService.finalizeDownload(payload.tdId, requester)
    : await tdService.finalizeView(payload.tdId, requester);

  // S3 repond NoSuchKey quand la cle est absente du bucket : l'enregistrement
  // existe en base, mais le fichier a ete supprime du stockage. Traduit en 404.
  // Toute autre erreur (reseau, credentials) reste un 500.
  let file;
  try {
    file = await storageProvider.getObjectStream(target.fileKey);
  } catch (err) {
    const sdk = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (sdk.name === "NoSuchKey" || sdk.$metadata?.httpStatusCode === 404) {
      throw new NotFoundError("Fichier introuvable dans le stockage");
    }
    throw err;
  }

  res.setHeader("Content-Type", file.contentType ?? "application/pdf");
  if (typeof file.contentLength === "number") {
    res.setHeader("Content-Length", String(file.contentLength));
  }
  // Jamais de mise en cache : la visibilite est re-evaluee a chaque requete,
  // un cache navigateur ou intermediaire contredirait ce controle.
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (isDownload) {
    // Repli ASCII pour les clients qui n'interpretent pas `filename*`.
    const ascii = target.downloadFileName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(target.downloadFileName)}`
    );
  } else {
    res.setHeader("Content-Disposition", "inline");
  }

  file.stream.on("error", () => res.destroy());
  file.stream.pipe(res);
}
