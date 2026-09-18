import { Router } from "express";
import * as controller from "../controllers/td.controller";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { uploadTdFile } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rateLimit";
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

router.get("/:id/download", requireAuth, asyncHandler(controller.downloadTdFile));
router.get("/:id/view", requireAuth, asyncHandler(controller.viewTdFile));

export default router;
