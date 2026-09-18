import { Request, Response } from "express";
import * as profileService from "../services/profile.service";
import { ChangePasswordInput, UpdateProfileInput } from "../validators/profile.validators";

export async function getProfile(req: Request, res: Response) {
  res.json(await profileService.getProfile(req.user!.id));
}

export async function updateProfile(req: Request, res: Response) {
  const input = req.body as UpdateProfileInput;
  res.json(await profileService.updateProfile(req.user!.id, input));
}

export async function changePassword(req: Request, res: Response) {
  const input = req.body as ChangePasswordInput;
  await profileService.changePassword(req.user!.id, input);
  res.status(204).send();
}
