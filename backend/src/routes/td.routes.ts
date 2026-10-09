import { Router } from "express";
import * as controller from "../controllers/td.controller";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { uploadTdFile } from "../middleware/upload";
import { fileAccessLimiter, uploadLimiter } from "../middleware/rateLimit";
import {
  createTdFileSchema,
  decideTdFileSchema,
  tdFileQuerySchema,
  updateTdFileSchema,
} from "../validators/td.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// req.user est optionnel ici (voir optionalAuth) : un visiteur non connecte
// voit uniquement les fiches PUBLISHED, mais un enseignant/admin connecte
// est reconnu pour voir ses propres brouillons (voir td.service).
router.get("/", optionalAuth, validateQuery(tdFileQuerySchema), asyncHandler(controller.listTdFiles));
router.get("/:id", optionalAuth, asyncHandler(controller.getTdFile));

router.post(
  "/",
  requireAuth,
  requireRole("TEACHER"),
  uploadLimiter,
  uploadTdFile,
  validateBody(createTdFileSchema),
  asyncHandler(controller.createTdFile)
);

router.put(
  "/:id",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  validateBody(updateTdFileSchema),
  asyncHandler(controller.updateTdFile)
);

router.put(
  "/:id/file",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  uploadLimiter,
  uploadTdFile,
  asyncHandler(controller.replaceTdFilePdf)
);

router.delete("/:id", requireAuth, requireRole("TEACHER", "ADMIN"), asyncHandler(controller.deleteTdFile));

router.post("/:id/submit", requireAuth, requireRole("TEACHER"), asyncHandler(controller.submitTdFile));

router.post(
  "/:id/decision",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(decideTdFileSchema),
  asyncHandler(controller.decideTdFile)
);

// Etape 1 (acces Bearer) : verifie les droits et rend une URL relative + un
// jeton de portee restreinte. Sans limite, ces deux routes sont un
// amplificateur gratuit pour saturer la base.
router.get("/:id/download", requireAuth, fileAccessLimiter, asyncHandler(controller.downloadTdFile));
router.get("/:id/view", requireAuth, fileAccessLimiter, asyncHandler(controller.viewTdFile));

// Etape 2 (flux, identifie par le jeton de fichier) : re-vefie le compte, la
// session et la visibilite de la fiche AVANT de streamer le PDF. C'est cette
// re-verification a chaque requete qui remplace l'URL signee S3 : une
// fiche retiree ou un compte desactive cessent d'avoir acces immediatement.
// Pas de requireAuth ici - le navigateur n'envoie pas d'Authorization sur une
// requete subie par un <iframe> ou par window.open.
router.get("/:id/file/view", fileAccessLimiter, asyncHandler(controller.streamTdFile));
router.get("/:id/file/download", fileAccessLimiter, asyncHandler(controller.streamTdFile));

export default router;
