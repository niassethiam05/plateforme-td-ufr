import { Router } from "express";
import * as controller from "../controllers/level.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { levelSchema } from "../validators/academic.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(controller.listLevels));
router.get("/:id", asyncHandler(controller.getLevel));

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(levelSchema),
  asyncHandler(controller.createLevel)
);
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(levelSchema.partial()),
  asyncHandler(controller.updateLevel)
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(controller.deleteLevel));

export default router;
