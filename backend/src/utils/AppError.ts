export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    // Pas de Object.setPrototypeOf ici : avec target ES2022 (voir
    // tsconfig.json), "extends Error" preserve deja correctement la
    // chaine de prototypes. Le forcer vers AppError.prototype ecraserait
    // au contraire celle des sous-classes (NotFoundError, etc.) et
    // casserait `instanceof NotFoundError` pour toute instance.
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentification requise") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acces refuse") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflit de donnees") {
    super(message, 409);
  }
}
