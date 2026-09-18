import { Router } from "express";
import * as controller from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { notificationQuerySchema } from "../validators/notification.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", requireAuth, validateQuery(notificationQuerySchema), asyncHandler(controller.listNotifications));
router.get("/unread-count", requireAuth, asyncHandler(controller.getUnreadCount));
router.patch("/read-all", requireAuth, asyncHandler(controller.markAllAsRead));
router.patch("/:id/read", requireAuth, asyncHandler(controller.markAsRead));

export default router;
