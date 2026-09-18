import { Request } from "express";
import rateLimit from "express-rate-limit";

/**
 * Limite les envois de fichiers (creation et remplacement du PDF d'une
 * fiche TD) : ces routes ecrivent dans le stockage S3/MinIO et sont plus
 * couteuses qu'un endpoint JSON classique — sans limite, un compte
 * enseignant compromis (ou un bug cote frontend qui boucle) pourrait
 * remplir le bucket en quelques secondes.
 *
 * Cle par utilisateur (pas par IP) : ces routes exigent deja requireAuth,
 * donc req.user est toujours defini en pratique. Cela evite qu'un reseau
 * partage (campus, proxy) ne fasse plafonner tout le monde ensemble, et
 * garde la limite efficace meme si le compte change d'IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? "anonymous",
  message: {
    error: "TooManyRequests",
    message: "Trop d'envois de fichiers en peu de temps, veuillez réessayer dans quelques minutes.",
  },
});
