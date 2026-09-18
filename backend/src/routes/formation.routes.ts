import { Router } from "express";
import * as controller from "../controllers/formation.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { formationSchema } from "../validators/academic.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Lecture publique : necessaire pour peupler les filtres du catalogue.
router.get("/", asyncHandler(controller.listFormations));
router.get("/:id", asyncHandler(controller.getFormation));

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(formationSchema),
  asyncHandler(controller.createFormation)
);
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(formationSchema.partial()),
  asyncHandler(controller.updateFormation)
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(controller.deleteFormation));

export default router;
