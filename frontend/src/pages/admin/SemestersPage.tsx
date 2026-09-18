import { useState } from "react";
import type { FormEvent } from "react";
import { Table } from "../../components/Table";
import { Modal } from "../../components/Modal";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import {
  useAcademicYears,
  useCreateSemester,
  useDeleteSemester,
  useFormations,
  useLevels,
  useSemesters,
} from "../../services/academic";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function SemestersPage() {
  const { data: formations } = useFormations();
  const { data: years } = useAcademicYears();
  const { data: semesters, isLoading } = useSemesters();
  const createSemester = useCreateSemester();
  const deleteSemester = useDeleteSemester();

  const [open, setOpen] = useState(false);
  const [formationId, setFormationId] = useState("");
  const { data: levelsForForm } = useLevels(formationId || undefined);
  const [form, setForm] = useState({ levelId: "", academicYearId: "", name: "", order: 1 });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await createSemester.mutateAsync(form);
      toastSuccess("Semestre créé avec succès.");
      setOpen(false);
      setForm({ levelId: "", academicYearId: "", name: "", order: 1 });
      setFormationId("");
    } catch {
      toastError("Impossible de créer ce semestre (existe-t-il déjà ?).");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer ce semestre ?")) return;
    try {
      await deleteSemester.mutateAsync(id);
      toastSuccess("Semestre supprimé.");
    } catch {
      toastError("Impossible de supprimer ce semestre.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Semestres</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Rattachez chaque semestre à un niveau et une année universitaire.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ajouter un semestre
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !semesters || semesters.length === 0 ? (
          <EmptyState title="Aucun semestre" description="Créez d'abord des niveaux et des années universitaires." />
        ) : (
          <Table columns={["Formation", "Niveau", "Semestre", "Année", "Matières", ""]}>
            {semesters.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.level?.formation.code}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.level?.name}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.academicYear?.label}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s._count?.subjects ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
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

      <Modal open={open} title="Nouveau semestre" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Formation</label>
            <select
              required
              value={formationId}
              onChange={(e) => {
                setFormationId(e.target.value);
                setForm((f) => ({ ...f, levelId: "" }));
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="" disabled>
                Choisir...
              </option>
              {formations?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Niveau</label>
              <select
                required
                disabled={!formationId}
                value={form.levelId}
                onChange={(e) => setForm((f) => ({ ...f, levelId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {levelsForForm?.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Année</label>
              <select
                required
                value={form.academicYearId}
                onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {years?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nom</label>
              <input
                required
                placeholder="Ex : S1, S2..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Ordre</label>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
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
              disabled={createSemester.isPending}
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
