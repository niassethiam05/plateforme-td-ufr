import { Router } from "express";
import * as controller from "../controllers/stats.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/admin", requireAuth, requireRole("ADMIN"), asyncHandler(controller.getAdminStats));
router.get("/teacher", requireAuth, requireRole("TEACHER"), asyncHandler(controller.getTeacherStats));

export default router;
