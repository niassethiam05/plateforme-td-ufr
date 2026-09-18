import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { Table } from "../../components/Table";
import { useReports, useResolveReport } from "../../services/reports";
import { toastError, toastSuccess } from "../../store/useToastStore";
import type { ReportStatus } from "../../types";

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "En attente",
  RESOLVED: "Traité",
  DISMISSED: "Classé sans suite",
};

const STATUS_STYLES: Record<ReportStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  DISMISSED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const TABS: { value: ReportStatus | undefined; label: string }[] = [
  { value: "PENDING", label: "En attente" },
  { value: "RESOLVED", label: "Traités" },
  { value: "DISMISSED", label: "Classés sans suite" },
  { value: undefined, label: "Tous" },
];

export function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | undefined>("PENDING");
  const { data, isLoading } = useReports(statusFilter);
  const resolve = useResolveReport();

  async function handleResolve(id: string, status: "RESOLVED" | "DISMISSED") {
    try {
      await resolve.mutateAsync({ id, status });
      toastSuccess(status === "RESOLVED" ? "Signalement marqué comme traité." : "Signalement classé sans suite.");
    } catch {
      toastError("Impossible de mettre à jour ce signalement.");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Signalements</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Fiches signalées par les utilisateurs pour un problème (fichier corrompu, contenu inapproprié...).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              statusFilter === tab.value
                ? "bg-brand-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Aucun signalement" description="Rien à traiter pour ce filtre." />
        ) : (
          <Table columns={["Fiche", "Motif", "Signalé par", "Statut", "Date", ""]}>
            {data.items.map((report) => (
              <tr key={report.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {report.tdFile ? (
                    <Link to={`/fiches/${report.tdFile.id}`} className="hover:text-brand-600">
                      {report.tdFile.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  <p>{report.reason}</p>
                  {report.description && <p className="mt-0.5 text-xs text-slate-400">{report.description}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {report.user ? `${report.user.firstName} ${report.user.lastName}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[report.status]}`}>
                    {STATUS_LABELS[report.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {new Date(report.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  {report.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleResolve(report.id, "RESOLVED")}
                        className="text-sm font-medium text-emerald-600 hover:underline"
                      >
                        Marquer traité
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(report.id, "DISMISSED")}
                        className="text-sm font-medium text-slate-500 hover:underline"
                      >
                        Classer sans suite
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
