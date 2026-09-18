import { Router } from "express";
import { login, logout, me, refresh, register } from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import { loginSchema, registerSchema } from "../validators/auth.validators";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/register", validateBody(registerSchema), asyncHandler(register));
router.post("/login", validateBody(loginSchema), asyncHandler(login));
router.post("/logout", asyncHandler(logout));
router.post("/refresh", asyncHandler(refresh));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
