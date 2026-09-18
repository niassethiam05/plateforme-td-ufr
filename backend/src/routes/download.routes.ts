import { Router } from "express";
import * as controller from "../controllers/download.controller";
import { requireAuth } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { downloadHistoryQuerySchema } from "../validators/download.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Chacun ne voit que son propre historique de telechargement.
router.get("/", requireAuth, validateQuery(downloadHistoryQuerySchema), asyncHandler(controller.listDownloadHistory));

export default router;
