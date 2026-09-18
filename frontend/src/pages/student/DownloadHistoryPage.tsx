import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { useDownloadHistory } from "../../services/downloads";
import { requestTdFileDownloadUrl } from "../../services/td";
import { toastError } from "../../store/useToastStore";

export function DownloadHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDownloadHistory(page);

  async function handleRedownload(tdFileId: string) {
    try {
      const url = await requestTdFileDownloadUrl(tdFileId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toastError("Impossible de télécharger cette fiche pour le moment.");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Historique de téléchargement</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Retrouvez ici toutes les fiches que vous avez téléchargées, de la plus récente à la plus ancienne.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Aucun téléchargement pour le moment"
            description="Les fiches que vous téléchargez apparaîtront ici."
            action={
              <Link
                to="/catalogue"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Voir le catalogue
              </Link>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {data.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <Link
                      to={`/fiches/${entry.tdFile.id}`}
                      className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100"
                    >
                      {entry.tdFile.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {entry.tdFile.subject?.name} —{" "}
                      {new Date(entry.downloadedAt).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  {entry.tdFile.status === "PUBLISHED" ? (
                    <button
                      type="button"
                      onClick={() => handleRedownload(entry.tdFile.id)}
                      className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Retélécharger
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">Fiche non disponible</span>
                  )}
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
