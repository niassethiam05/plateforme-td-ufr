import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
} from "../services/notifications";
import type { Notification } from "../types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications(page);
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  function handleSelect(n: Notification) {
    if (!n.isRead) markAsRead.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Toutes vos notifications, des plus récentes aux plus anciennes.
          </p>
        </div>
        {!!data?.unreadCount && (
          <button
            type="button"
            onClick={() => markAllAsRead.mutate()}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Aucune notification" description="Vous serez averti ici des événements importants." />
        ) : (
          <>
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`flex w-full flex-col gap-1 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      !n.isRead ? "bg-brand-50/60 dark:bg-brand-900/10" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                      {n.title}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{n.message}</span>
                    <span className="text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Précédent
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Page {data.page} / {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
