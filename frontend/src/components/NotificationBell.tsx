import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../services/notifications";
import type { Notification } from "../types";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data } = useNotifications(1, 6);
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  function handleSelect(n: Notification) {
    if (!n.isRead) markAsRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {!!unreadCount && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
              {!!unreadCount && (
                <button
                  type="button"
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {!data || data.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune notification.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(n)}
                        className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                          !n.isRead ? "bg-brand-50/60 dark:bg-brand-900/10" : ""
                        }`}
                      >
                        <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                          {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
                          {n.title}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{n.message}</span>
                        <span className="text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              Voir toutes les notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
