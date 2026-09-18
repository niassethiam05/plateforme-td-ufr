import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { FavoriteButton } from "../../components/FavoriteButton";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { requestTdFileDownloadUrl } from "../../services/td";
import { useFavorites } from "../../services/favorites";
import { toastError } from "../../store/useToastStore";

export function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();

  async function handleDownload(id: string) {
    try {
      const url = await requestTdFileDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toastError("Impossible de télécharger cette fiche pour le moment.");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Mes favoris</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Retrouvez ici toutes les fiches de TD que vous avez mises de côté.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !favorites || favorites.length === 0 ? (
          <EmptyState
            title="Aucun favori pour le moment"
            description="Parcourez le catalogue et cliquez sur l'étoile d'une fiche pour l'ajouter ici."
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((td) => (
              <div
                key={td.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{td.title}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={td.status} />
                    <FavoriteButton tdFileId={td.id} isFavorite />
                  </div>
                </div>
                <dl className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <div>Matière : {td.subject?.name}</div>
                  <div>
                    Formation : {td.subject?.semester?.level?.formation.code} — {td.subject?.semester?.level?.name}
                  </div>
                  <div>
                    Enseignant : {td.teacher ? `${td.teacher.user.firstName} ${td.teacher.user.lastName}` : "—"}
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Link
                    to={`/fiches/${td.id}`}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Consulter
                  </Link>
                  {td.status === "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() => handleDownload(td.id)}
                      className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Télécharger
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
