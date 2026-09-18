import { useState } from "react";
import type { FormEvent } from "react";
import { Table } from "../../components/Table";
import { Modal } from "../../components/Modal";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { useCreateLevel, useDeleteLevel, useFormations, useLevels } from "../../services/academic";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function LevelsPage() {
  const { data: formations } = useFormations();
  const { data: levels, isLoading } = useLevels();
  const createLevel = useCreateLevel();
  const deleteLevel = useDeleteLevel();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ formationId: "", name: "", order: 1 });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await createLevel.mutateAsync(form);
      toastSuccess("Niveau créé avec succès.");
      setOpen(false);
      setForm({ formationId: "", name: "", order: 1 });
    } catch {
      toastError("Impossible de créer ce niveau (existe-t-il déjà ?).");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer ce niveau ?")) return;
    try {
      await deleteLevel.mutateAsync(id);
      toastSuccess("Niveau supprimé.");
    } catch {
      toastError("Impossible de supprimer ce niveau.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Niveaux</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ex : Licence 1, Licence 2, Master 1...
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ajouter un niveau
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !levels || levels.length === 0 ? (
          <EmptyState title="Aucun niveau" description="Créez d'abord une formation, puis ses niveaux." />
        ) : (
          <Table columns={["Formation", "Niveau", "Ordre", "Semestres", ""]}>
            {levels.map((lvl) => (
              <tr key={lvl.id}>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lvl.formation?.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{lvl.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lvl.order}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lvl._count?.semesters ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(lvl.id)}
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

      <Modal open={open} title="Nouveau niveau" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Formation</label>
            <select
              required
              value={form.formationId}
              onChange={(e) => setForm((f) => ({ ...f, formationId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="" disabled>
                Choisir...
              </option>
              {formations?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nom du niveau</label>
            <input
              required
              placeholder="Ex : L1, L2, M1..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Ordre d'affichage</label>
            <input
              type="number"
              min={0}
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
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
              disabled={createLevel.isPending}
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
