import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../utils/AppError";

/**
 * Valide req.body avec un schema Zod et remplace req.body par la version
 * typee/nettoyee. Renvoie une erreur 400 explicite si la validation echoue.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      return next(new AppError(message, 422));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Valide req.query. La copie validee est stockee dans res.locals.query
 * plutot que reassignee a req.query, car req.query est en lecture seule
 * sur les versions recentes d'Express/Node (getter sans setter).
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      return next(new AppError(message, 422));
    }
    res.locals.query = result.data;
    next();
  };
}
