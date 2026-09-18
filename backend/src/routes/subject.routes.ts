import { Router } from "express";
import * as controller from "../controllers/subject.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { subjectSchema } from "../validators/academic.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(controller.listSubjects));
router.get("/:id", asyncHandler(controller.getSubject));

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(subjectSchema),
  asyncHandler(controller.createSubject)
);
router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(subjectSchema.partial()),
  asyncHandler(controller.updateSubject)
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(controller.deleteSubject));

export default router;
