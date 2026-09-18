import { useState } from "react";
import { Table } from "../../components/Table";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { Modal } from "../../components/Modal";
import { useDecideTdFile, useTdFiles } from "../../services/td";
import { toastError, toastSuccess } from "../../store/useToastStore";
import type { TdFile } from "../../types";

export function ValidationPage() {
  const { data, isLoading } = useTdFiles({ status: "PENDING", pageSize: 50 });
  const decide = useDecideTdFile();
  const [rejecting, setRejecting] = useState<TdFile | null>(null);
  const [comment, setComment] = useState("");

  async function handleApprove(id: string) {
    try {
      await decide.mutateAsync({ id, approve: true });
      toastSuccess("Fiche validée et publiée.");
    } catch {
      toastError("Impossible de valider cette fiche.");
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    try {
      await decide.mutateAsync({ id: rejecting.id, approve: false, adminComment: comment });
      toastSuccess("Fiche refusée, l'enseignant a été informé.");
      setRejecting(null);
      setComment("");
    } catch {
      toastError("Impossible de refuser cette fiche.");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Validation des fiches</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Fiches soumises par les enseignants, en attente de votre décision.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Aucune fiche en attente" description="Tout est à jour." />
        ) : (
          <Table columns={["Titre", "Matière", "Enseignant", "Soumise le", ""]}>
            {data.items.map((td) => (
              <tr key={td.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{td.title}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{td.subject?.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {td.teacher ? `${td.teacher.user.firstName} ${td.teacher.user.lastName}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {new Date(td.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    type="button"
                    onClick={() => handleApprove(td.id)}
                    className="text-sm font-medium text-emerald-600 hover:underline"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(td)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Refuser
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal
        open={!!rejecting}
        title={`Refuser "${rejecting?.title ?? ""}"`}
        onClose={() => setRejecting(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRejecting(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Confirmer le refus
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Motif / demande de modification
        </label>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ex : merci de vérifier la numérotation des exercices."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </Modal>
    </div>
  );
}
