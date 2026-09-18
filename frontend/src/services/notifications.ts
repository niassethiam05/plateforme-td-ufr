import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Notification, PaginatedResult } from "../types";
import { useAuthStore } from "../store/useAuthStore";

export type NotificationList = PaginatedResult<Notification> & { unreadCount: number };

export function useNotifications(page: number, pageSize = 15) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["notifications", page, pageSize],
    queryFn: async () =>
      (await api.get<NotificationList>("/notifications", { params: { page, pageSize } })).data,
    enabled: isAuthenticated,
    placeholderData: (previous) => previous,
  });
}

/** Polling leger pour tenir le badge de la cloche a jour sans websocket. */
export function useUnreadNotificationCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => (await api.get<{ count: number }>("/notifications/unread-count")).data.count,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}
