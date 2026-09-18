import { Link } from "react-router-dom";
import { Table } from "../../components/Table";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useDeleteTdFile, useSubmitTdFile, useTdFiles } from "../../services/td";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function MyTdFilesPage() {
  const { data, isLoading } = useTdFiles({ mine: true, pageSize: 50 });
  const submitTdFile = useSubmitTdFile();
  const deleteTdFile = useDeleteTdFile();

  async function handleSubmit(id: string) {
    try {
      await submitTdFile.mutateAsync(id);
      toastSuccess("Fiche soumise pour validation.");
    } catch {
      toastError("Impossible de soumettre cette fiche.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer définitivement cette fiche ?")) return;
    try {
      await deleteTdFile.mutateAsync(id);
      toastSuccess("Fiche supprimée.");
    } catch {
      toastError("Impossible de supprimer cette fiche.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Mes fiches</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Brouillons, fiches en attente, publiées ou refusées.
          </p>
        </div>
        <Link
          to="/teacher/fiches/ajouter"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ajouter une fiche
        </Link>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Aucune fiche pour le moment"
            description="Publiez votre première fiche de TD."
            action={
              <Link
                to="/teacher/fiches/ajouter"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Ajouter une fiche
              </Link>
            }
          />
        ) : (
          <Table columns={["Titre", "Matière", "Statut", "Téléchargements", "Commentaire admin", ""]}>
            {data.items.map((td) => (
              <tr key={td.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{td.title}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{td.subject?.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={td.status} />
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{td.downloadCount}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{td.adminComment ?? "—"}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <Link to={`/fiches/${td.id}`} className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-300">
                    Consulter
                  </Link>
                  {(td.status === "DRAFT" || td.status === "REJECTED") && (
                    <button
                      type="button"
                      onClick={() => handleSubmit(td.id)}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      Soumettre
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(td.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
