import { Request, Response } from "express";
import * as favoriteService from "../services/favorite.service";

export async function listFavorites(req: Request, res: Response) {
  res.json(await favoriteService.listFavorites(req.user!.id));
}

export async function addFavorite(req: Request, res: Response) {
  await favoriteService.addFavorite(req.user!, req.params.tdFileId);
  res.status(204).send();
}

export async function removeFavorite(req: Request, res: Response) {
  await favoriteService.removeFavorite(req.user!.id, req.params.tdFileId);
  res.status(204).send();
}
