import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAcademicYears,
  useFormations,
  useLevels,
  useSemesters,
  useSubjects,
} from "../../services/academic";
import { useCreateTdFile } from "../../services/td";
import { toastError, toastSuccess } from "../../store/useToastStore";

export function AddTdFilePage() {
  const navigate = useNavigate();
  const { data: formations } = useFormations();
  const { data: years } = useAcademicYears();
  const createTdFile = useCreateTdFile();

  const [formationId, setFormationId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const { data: levels } = useLevels(formationId || undefined);
  const { data: semesters } = useSemesters(levelId || undefined);
  const { data: subjects } = useSubjects(semesterId || undefined);

  const [form, setForm] = useState({
    title: "",
    description: "",
    subjectId: "",
    academicYearId: years?.find((y) => y.isCurrent)?.id ?? "",
    tdNumber: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Le fichier PDF de la fiche est requis.");
      return;
    }
    if (!form.subjectId || !form.academicYearId) {
      setError("Merci de sélectionner la matière et l'année universitaire.");
      return;
    }

    try {
      await createTdFile.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        subjectId: form.subjectId,
        academicYearId: form.academicYearId,
        tdNumber: form.tdNumber ? Number(form.tdNumber) : undefined,
        file,
        coverImage: coverImage ?? undefined,
      });
      toastSuccess("Fiche créée en brouillon. Pensez à la soumettre pour validation.");
      navigate("/teacher/fiches");
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        "Impossible de créer la fiche.";
      setError(message);
      toastError(message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Ajouter une fiche de TD</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        La fiche sera créée en brouillon ; vous pourrez la soumettre pour validation depuis "Mes fiches".
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Titre</label>
          <input
            required
            placeholder="Ex : TD 03 — Jointures SQL"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Formation</label>
            <select
              required
              value={formationId}
              onChange={(e) => {
                setFormationId(e.target.value);
                setLevelId("");
                setSemesterId("");
                setForm((f) => ({ ...f, subjectId: "" }));
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
                setSemesterId("");
                setForm((f) => ({ ...f, subjectId: "" }));
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="" disabled>
                Choisir...
              </option>
              {levels?.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Semestre</label>
            <select
              required
              disabled={!levelId}
              value={semesterId}
              onChange={(e) => {
                setSemesterId(e.target.value);
                setForm((f) => ({ ...f, subjectId: "" }));
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="" disabled>
                Choisir...
              </option>
              {semesters?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.academicYear?.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Matière</label>
            <select
              required
              disabled={!semesterId}
              value={form.subjectId}
              onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="" disabled>
                Choisir...
              </option>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Année universitaire</label>
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
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Numéro du TD</label>
            <input
              type="number"
              min={1}
              value={form.tdNumber}
              onChange={(e) => setForm((f) => ({ ...f, tdNumber: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Fichier PDF</label>
          <input
            required
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:file:bg-slate-800"
          />
          <p className="mt-1 text-xs text-slate-400">PDF uniquement, 20 Mo maximum.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Image de couverture (optionnel)
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setCoverImage(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:file:bg-slate-800"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={createTdFile.isPending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createTdFile.isPending ? "Envoi en cours..." : "Créer la fiche"}
        </button>
      </form>
    </div>
  );
}
