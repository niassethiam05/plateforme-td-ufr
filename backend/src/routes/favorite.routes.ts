import { Router } from "express";
import * as controller from "../controllers/favorite.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Reserve aux utilisateurs connectes (etudiant, enseignant ou admin) : chacun
// gere ses propres favoris, il n'y a pas de restriction de role supplementaire.
router.get("/", requireAuth, asyncHandler(controller.listFavorites));
router.post("/:tdFileId", requireAuth, asyncHandler(controller.addFavorite));
router.delete("/:tdFileId", requireAuth, asyncHandler(controller.removeFavorite));

export default router;
