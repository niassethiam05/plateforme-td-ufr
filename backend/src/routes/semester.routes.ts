import { Router } from "express";
import * as controller from "../controllers/semester.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { semesterSchema } from "../validators/academic.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(controller.listSemesters));
router.get("/:id", asyncHandler(controller.getSemester));

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(semesterSchema),
  asyncHandler(controller.createSemester)
);
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(semesterSchema.partial()),
  asyncHandler(controller.updateSemester)
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(controller.deleteSemester));

export default router;
