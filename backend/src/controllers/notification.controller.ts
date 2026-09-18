import { Request, Response } from "express";
import * as notificationService from "../services/notification.service";
import { NotificationQuery } from "../validators/notification.validators";

export async function listNotifications(req: Request, res: Response) {
  const query = res.locals.query as NotificationQuery;
  res.json(await notificationService.listNotifications(req.user!.id, query));
}

export async function getUnreadCount(req: Request, res: Response) {
  res.json({ count: await notificationService.getUnreadCount(req.user!.id) });
}

export async function markAsRead(req: Request, res: Response) {
  await notificationService.markAsRead(req.user!.id, req.params.id);
  res.status(204).send();
}

export async function markAllAsRead(req: Request, res: Response) {
  await notificationService.markAllAsRead(req.user!.id);
  res.status(204).send();
}
