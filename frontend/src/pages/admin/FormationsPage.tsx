import { useState } from "react";
import type { FormEvent } from "react";
import { Table } from "../../components/Table";
import { Modal } from "../../components/Modal";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { useCreateFormation, useDeleteFormation, useFormations } from "../../services/academic";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function FormationsPage() {
  const { data: formations, isLoading } = useFormations();
  const createFormation = useCreateFormation();
  const deleteFormation = useDeleteFormation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await createFormation.mutateAsync(form);
      toastSuccess("Formation créée avec succès.");
      setOpen(false);
      setForm({ name: "", code: "", description: "" });
    } catch {
      toastError("Impossible de créer la formation (code déjà utilisé ?).");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer cette formation ? Cette action est irréversible.")) return;
    try {
      await deleteFormation.mutateAsync(id);
      toastSuccess("Formation supprimée.");
    } catch {
      toastError("Impossible de supprimer cette formation.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Formations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gérez les formations proposées par l'UFR.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ajouter une formation
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !formations || formations.length === 0 ? (
          <EmptyState title="Aucune formation" description="Commencez par en créer une." />
        ) : (
          <Table columns={["Code", "Nom", "Niveaux", "Étudiants", ""]}>
            {formations.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{f.code}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{f.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{f._count?.levels ?? 0}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{f._count?.students ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(f.id)}
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

      <Modal open={open} title="Nouvelle formation" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Code</label>
            <input
              required
              placeholder="Ex : MIO"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nom</label>
            <input
              required
              placeholder="Ex : Management Informatisé des Organisations"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createFormation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Créer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
