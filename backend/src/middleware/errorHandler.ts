import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route introuvable: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  console.error("Erreur non geree:", err);
  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Une erreur interne est survenue.",
  });
}
