import { Router } from "express";
import * as controller from "../controllers/report.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { createReportSchema, reportQuerySchema, resolveReportSchema } from "../validators/report.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Tout utilisateur connecte peut signaler une fiche publiee.
router.post("/:tdFileId", requireAuth, validateBody(createReportSchema), asyncHandler(controller.createReport));

// Seul un admin consulte et traite les signalements.
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateQuery(reportQuerySchema),
  asyncHandler(controller.listReports)
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(resolveReportSchema),
  asyncHandler(controller.resolveReport)
);

export default router;
