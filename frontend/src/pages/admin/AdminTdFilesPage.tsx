import { useState } from "react";
import { Table } from "../../components/Table";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useDeleteTdFile, useTdFiles } from "../../services/td";
import { toastError, toastSuccess } from "../../store/useToastStore";
import type { TdFileStatus } from "../../types";

const STATUS_OPTIONS: { value: TdFileStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "PENDING", label: "En attente" },
  { value: "PUBLISHED", label: "Publiée" },
  { value: "REJECTED", label: "Refusée" },
];

export function AdminTdFilesPage() {
  const [status, setStatus] = useState<TdFileStatus | "ALL">("ALL");
  const { data, isLoading } = useTdFiles({ status: status === "ALL" ? undefined : status, pageSize: 50 });
  const deleteTdFile = useDeleteTdFile();

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Fiches de TD</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Toutes les fiches de la plateforme, tous statuts confondus.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TdFileStatus | "ALL")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Aucune fiche" />
        ) : (
          <Table columns={["Titre", "Matière", "Enseignant", "Statut", "Téléchargements", ""]}>
            {data.items.map((td) => (
              <tr key={td.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{td.title}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{td.subject?.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {td.teacher ? `${td.teacher.user.firstName} ${td.teacher.user.lastName}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={td.status} />
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{td.downloadCount}</td>
                <td className="px-4 py-3 text-right">
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
