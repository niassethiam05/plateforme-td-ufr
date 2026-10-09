import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route introuvable: ${req.method} ${req.originalUrl}`,
  });
}

interface ClientError {
  statusCode: number;
  error: string;
  message: string;
}

/**
 * Traduit les erreurs des bibliotheques qui correspondent a une faute du
 * client (fichier refuse, doublon, reference invalide, JSON mal forme) en
 * reponse 4xx avec un message exploitable. Sans cette traduction, elles
 * tombaient toutes dans le 500 generique : l'utilisateur lisait "erreur
 * interne" pour un PDF trop lourd ou un code de formation deja pris.
 *
 * Renvoie undefined pour tout le reste, qui reste un vrai 500.
 */
function toClientError(err: unknown): ClientError | undefined {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return {
        statusCode: 413,
        error: "FileTooLarge",
        message: "Le fichier dépasse la taille maximale autorisée.",
      };
    }
    // Champ de fichier inattendu, trop de fichiers, etc.
    return {
      statusCode: 422,
      error: "InvalidUpload",
      message: "Envoi de fichier invalide : vérifiez les fichiers joints.",
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Contrainte d'unicite (code de formation, email, niveau en double...).
      case "P2002":
        return {
          statusCode: 409,
          error: "ConflictError",
          message: "Un élément identique existe déjà.",
        };
      // Cle etrangere : soit l'element reference n'existe pas (creation,
      // modification), soit l'element supprime est encore utilise ailleurs.
      // Prisma ne distingue pas les deux cas, le message couvre donc les deux.
      case "P2003":
        return {
          statusCode: 409,
          error: "ConflictError",
          message: "Opération impossible : un élément lié est introuvable ou encore utilisé.",
        };
      // update/delete sur une ligne qui n'existe pas (ou plus).
      case "P2025":
        return {
          statusCode: 404,
          error: "NotFoundError",
          message: "Ressource introuvable",
        };
      default:
        return undefined;
    }
  }

  // Erreurs de express.json() : corps JSON mal forme ou trop volumineux.
  const bodyError = err as { type?: string } | null;
  if (bodyError?.type === "entity.parse.failed") {
    return { statusCode: 400, error: "InvalidJson", message: "Corps de requête JSON invalide." };
  }
  if (bodyError?.type === "entity.too.large") {
    return { statusCode: 413, error: "PayloadTooLarge", message: "Corps de requête trop volumineux." };
  }

  return undefined;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.constructor.name,
      message: err.message,
    });
  }

  const clientError = toClientError(err);
  if (clientError) {
    return res.status(clientError.statusCode).json({
      error: clientError.error,
      message: clientError.message,
    });
  }

  console.error("Erreur non geree:", err);
  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Une erreur interne est survenue.",
  });
}
