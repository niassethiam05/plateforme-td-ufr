import { Router } from "express";
import { z } from "zod";
import * as controller from "../controllers/user.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", asyncHandler(controller.listUsers));
router.patch(
  "/:id/active",
  validateBody(z.object({ isActive: z.boolean() })),
  asyncHandler(controller.setUserActive)
);

export default router;
