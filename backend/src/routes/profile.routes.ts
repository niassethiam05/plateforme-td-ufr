import { Router } from "express";
import * as controller from "../controllers/profile.controller";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { changePasswordSchema, updateProfileSchema } from "../validators/profile.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Chacun gere son propre profil (monte a part de /users, qui est
// reserve a l'admin — voir user.routes.ts).
router.get("/", requireAuth, asyncHandler(controller.getProfile));
router.patch("/", requireAuth, validateBody(updateProfileSchema), asyncHandler(controller.updateProfile));
router.patch(
  "/password",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(controller.changePassword)
);

export default router;
