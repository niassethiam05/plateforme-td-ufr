import { Router } from "express";
import * as controller from "../controllers/report.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { reportLimiter } from "../middleware/rateLimit";
import { createReportSchema, reportQuerySchema, resolveReportSchema } from "../validators/report.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Tout utilisateur connecte peut signaler une fiche publiee. Limite : chaque
// signalement notifie TOUS les administrateurs, donc une boucle en produit
// autant d'ecritures que d'administrateurs.
router.post(
  "/:tdFileId",
  requireAuth,
  reportLimiter,
  validateBody(createReportSchema),
  asyncHandler(controller.createReport)
);

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
