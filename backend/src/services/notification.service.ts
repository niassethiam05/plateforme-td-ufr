import { NotificationType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/AppError";
import { NotificationQuery } from "../validators/notification.validators";

export async function listNotifications(userId: string, query: NotificationQuery) {
  const skip = (query.page - 1) * query.pageSize;

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    unreadCount,
  };
}

export function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(userId: string, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  // 404 (et non 403) meme si la notification existe mais appartient a
  // quelqu'un d'autre : evite de confirmer a un utilisateur l'existence
  // d'un identifiant de notification qui n'est pas le sien.
  if (!notification || notification.userId !== userId) {
    throw new NotFoundError("Notification introuvable");
  }
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

/**
 * Cree une notification pour un utilisateur. Usage interne uniquement
 * (appele par d'autres services suite a un evenement metier, ex.
 * validation/refus d'une fiche) : pas de route qui expose cette creation
 * directement au client.
 */
export function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "GENERAL",
      link: input.link,
    },
  });
}

/**
 * Variante en masse (ex: notifier tous les etudiants d'une filiere/niveau
 * qu'une nouvelle fiche est publiee) : une seule requete au lieu d'une
 * creation par destinataire, plus adaptee quand le nombre de destinataires
 * peut etre grand.
 */
export async function createManyNotifications(inputs: CreateNotificationInput[]) {
  if (!inputs.length) return;
  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "GENERAL",
      link: input.link,
    })),
  });
}
