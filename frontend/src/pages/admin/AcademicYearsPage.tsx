import { useState } from "react";
import type { FormEvent } from "react";
import { Table } from "../../components/Table";
import { Modal } from "../../components/Modal";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { useAcademicYears, useCreateAcademicYear, useDeleteAcademicYear } from "../../services/academic";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function AcademicYearsPage() {
  const { data: years, isLoading } = useAcademicYears();
  const createYear = useCreateAcademicYear();
  const deleteYear = useDeleteAcademicYear();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", startDate: "", endDate: "", isCurrent: false });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await createYear.mutateAsync(form);
      toastSuccess("Année universitaire créée.");
      setOpen(false);
      setForm({ label: "", startDate: "", endDate: "", isCurrent: false });
    } catch {
      toastError("Impossible de créer cette année (format attendu : AAAA-AAAA).");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer cette année universitaire ?")) return;
    try {
      await deleteYear.mutateAsync(id);
      toastSuccess("Année supprimée.");
    } catch {
      toastError("Impossible de supprimer cette année (des semestres y sont peut-être rattachés).");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Années universitaires</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Nécessaires pour créer des semestres.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ajouter une année
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !years || years.length === 0 ? (
          <EmptyState title="Aucune année universitaire" />
        ) : (
          <Table columns={["Label", "Début", "Fin", "Actuelle", ""]}>
            {years.map((y) => (
              <tr key={y.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{y.label}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {new Date(y.startDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {new Date(y.endDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  {y.isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Actuelle
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(y.id)}
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

      <Modal open={open} title="Nouvelle année universitaire" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Label</label>
            <input
              required
              placeholder="Ex : 2026-2027"
              pattern="\d{4}-\d{4}"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Début</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Fin</label>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm((f) => ({ ...f, isCurrent: e.target.checked }))}
              className="rounded border-slate-300"
            />
            Définir comme année universitaire actuelle
          </label>
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
              disabled={createYear.isPending}
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
