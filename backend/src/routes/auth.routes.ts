import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPasswordWithToken,
} from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validators";
import { requireAuth } from "../middleware/auth";
import {
  loginIpLimiter,
  loginLimiter,
  passwordResetIpLimiter,
  passwordResetLimiter,
  registerLimiter,
  sessionLimiter,
} from "../middleware/rateLimit";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/register", registerLimiter, validateBody(registerSchema), asyncHandler(register));
router.post("/login", loginIpLimiter, loginLimiter, validateBody(loginSchema), asyncHandler(login));
// Rotation a chaque appel : /refresh touche la base (relecture, revocation,
// emission) et ne doit pas pouvoir etre boucle par un attaquant.
// La limite est posee AVANT le handler, donc avant toute ecriture.
router.post("/refresh", sessionLimiter, asyncHandler(refresh));
router.post("/logout", sessionLimiter, asyncHandler(logout));
router.post(
  "/forgot-password",
  passwordResetIpLimiter,
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(forgotPassword)
);
router.post(
  "/reset-password",
  passwordResetIpLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(resetPasswordWithToken)
);
router.get("/me", requireAuth, asyncHandler(me));

export default router;
