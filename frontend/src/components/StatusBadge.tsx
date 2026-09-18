import type { TdFileStatus } from "../types";

const LABELS: Record<TdFileStatus, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  VALIDATED: "Validée",
  REJECTED: "Refusée",
  PUBLISHED: "Publiée",
};

const STYLES: Record<TdFileStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  VALIDATED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export function StatusBadge({ status }: { status: TdFileStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
