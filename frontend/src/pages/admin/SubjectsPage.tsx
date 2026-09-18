import { useState } from "react";
import type { FormEvent } from "react";
import { Table } from "../../components/Table";
import { Modal } from "../../components/Modal";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import {
  useCreateSubject,
  useDeleteSubject,
  useFormations,
  useLevels,
  useSemesters,
  useSubjects,
} from "../../services/academic";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function SubjectsPage() {
  const { data: formations } = useFormations();
  const { data: subjects, isLoading } = useSubjects();
  const createSubject = useCreateSubject();
  const deleteSubject = useDeleteSubject();

  const [open, setOpen] = useState(false);
  const [formationId, setFormationId] = useState("");
  const [levelId, setLevelId] = useState("");
  const { data: levelsForForm } = useLevels(formationId || undefined);
  const { data: semestersForForm } = useSemesters(levelId || undefined);
  const [form, setForm] = useState({ semesterId: "", name: "", code: "", description: "" });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await createSubject.mutateAsync(form);
      toastSuccess("Matière créée avec succès.");
      setOpen(false);
      setForm({ semesterId: "", name: "", code: "", description: "" });
      setFormationId("");
      setLevelId("");
    } catch {
      toastError("Impossible de créer cette matière.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer cette matière ? Les fiches associées seront également supprimées.")) return;
    try {
      await deleteSubject.mutateAsync(id);
      toastSuccess("Matière supprimée.");
    } catch {
      toastError("Impossible de supprimer cette matière.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Matières</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Les fiches de TD sont rattachées à une matière.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ajouter une matière
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !subjects || subjects.length === 0 ? (
          <EmptyState title="Aucune matière" description="Créez d'abord un semestre." />
        ) : (
          <Table columns={["Matière", "Semestre", "Niveau", "Enseignant référent", "Fiches", ""]}>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {s.semester?.name} — {s.semester?.academicYear?.label}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {s.semester?.level?.formation.code} {s.semester?.level?.name}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {s.mainTeacher ? `${s.mainTeacher.user.firstName} ${s.mainTeacher.user.lastName}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s._count?.tdFiles ?? 0}</td>
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

      <Modal open={open} title="Nouvelle matière" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Formation</label>
              <select
                required
                value={formationId}
                onChange={(e) => {
                  setFormationId(e.target.value);
                  setLevelId("");
                  setForm((f) => ({ ...f, semesterId: "" }));
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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Niveau</label>
              <select
                required
                disabled={!formationId}
                value={levelId}
                onChange={(e) => {
                  setLevelId(e.target.value);
                  setForm((f) => ({ ...f, semesterId: "" }));
                }}
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
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Semestre</label>
            <select
              required
              disabled={!levelId}
              value={form.semesterId}
              onChange={(e) => setForm((f) => ({ ...f, semesterId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="" disabled>
                Choisir...
              </option>
              {semestersForForm?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.academicYear?.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nom de la matière</label>
            <input
              required
              placeholder="Ex : Base de données"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
              disabled={createSubject.isPending}
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
