import { Router } from "express";
import { z } from "zod";
import * as controller from "../controllers/user.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

// Le role est valide en Zod et non caste : sans cela, `?role=NIMPEC` arrivait
// dans Prisma comme Role et provoquait une erreur 500 au lieu d'un 400.
// "PENDING" n'est pas un role mais un filtre metier sur l'absence de
// teacherApprovedAt (comptes enseignants en attente de validation).
const listUsersQuery = z.object({
  role: z.enum(["STUDENT", "TEACHER", "ADMIN", "PENDING"]).optional(),
});

router.get("/", validateQuery(listUsersQuery), asyncHandler(controller.listUsers));
router.patch(
  "/:id/active",
  validateBody(z.object({ isActive: z.boolean() })),
  asyncHandler(controller.setUserActive)
);

export default router;