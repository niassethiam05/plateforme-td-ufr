import { Router } from "express";
import * as controller from "../controllers/academicYear.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { academicYearSchema } from "../validators/academic.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(controller.listAcademicYears));
router.get("/:id", asyncHandler(controller.getAcademicYear));

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(academicYearSchema),
  asyncHandler(controller.createAcademicYear)
);
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(academicYearSchema.partial()),
  asyncHandler(controller.updateAcademicYear)
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(controller.deleteAcademicYear));

export default router;
