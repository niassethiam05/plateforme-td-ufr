import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { FavoriteButton } from "../../components/FavoriteButton";
import { Spinner } from "../../components/Spinner";
import { useAcademicYears, useFormations, useLevels, useSemesters, useSubjects } from "../../services/academic";
import { requestTdFileDownloadUrl, useTdFiles } from "../../services/td";
import { useAuthStore } from "../../store/useAuthStore";
import { toastError } from "../../store/useToastStore";

export function CataloguePage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Un etudiant est cantonne a sa propre filiere : le filtre est verrouille
  // sur son profil et ne peut pas etre change ici. La restriction reelle
  // est de toute facon appliquee cote backend (voir td.service.ts), ce
  // verrouillage est surtout une question de clarte pour l'utilisateur.
  const studentFormation = user?.role === "STUDENT" ? user.formation : undefined;

  const [search, setSearch] = useState("");
  const [formationId, setFormationId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [page, setPage] = useState(1);

  const effectiveFormationId = studentFormation?.id ?? formationId;

  const { data: formations } = useFormations();
  const { data: levels } = useLevels(effectiveFormationId || undefined);
  const { data: semesters } = useSemesters(levelId || undefined);
  const { data: subjects } = useSubjects(semesterId || undefined);
  const { data: years } = useAcademicYears();

  const { data, isLoading } = useTdFiles({
    search: search || undefined,
    formationId: effectiveFormationId || undefined,
    levelId: levelId || undefined,
    semesterId: semesterId || undefined,
    subjectId: subjectId || undefined,
    academicYearId: academicYearId || undefined,
    page,
    pageSize: 9,
  });

  async function handleDownload(id: string) {
    if (!isAuthenticated) {
      toastError("Connectez-vous pour télécharger une fiche.");
      navigate("/connexion");
      return;
    }
    try {
      const url = await requestTdFileDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toastError("Impossible de télécharger cette fiche pour le moment.");
    }
  }

  function resetToPage1<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Catalogue des fiches de TD</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {studentFormation
          ? `Fiches de votre filière (${studentFormation.name}). Recherchez et filtrez par niveau, semestre ou matière.`
          : "Recherchez et filtrez toutes les fiches publiées par les enseignants."}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
        <input
          value={search}
          onChange={(e) => resetToPage1(setSearch)(e.target.value)}
          placeholder="Rechercher un titre, une matière, un enseignant..."
          className="col-span-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white lg:col-span-2"
        />
        {studentFormation ? (
          <div
            title="Vous ne voyez que les fiches de votre filière"
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            {studentFormation.code}
          </div>
        ) : (
          <select
            value={formationId}
            onChange={(e) => {
              resetToPage1(setFormationId)(e.target.value);
              setLevelId("");
              setSemesterId("");
              setSubjectId("");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Toutes les formations</option>
            {formations?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code}
              </option>
            ))}
          </select>
        )}
        <select
          value={levelId}
          disabled={!effectiveFormationId}
          onChange={(e) => {
            resetToPage1(setLevelId)(e.target.value);
            setSemesterId("");
            setSubjectId("");
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Tous les niveaux</option>
          {levels?.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.name}
            </option>
          ))}
        </select>
        <select
          value={semesterId}
          disabled={!levelId}
          onChange={(e) => {
            resetToPage1(setSemesterId)(e.target.value);
            setSubjectId("");
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Tous les semestres</option>
          {semesters?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={subjectId}
          disabled={!semesterId}
          onChange={(e) => resetToPage1(setSubjectId)(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Toutes les matières</option>
          {subjects?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={academicYearId}
          onChange={(e) => resetToPage1(setAcademicYearId)(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">Toutes les années</option>
          {years?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Aucune fiche trouvée" description="Essayez d'élargir vos filtres de recherche." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((td) => (
                <div
                  key={td.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">{td.title}</p>
                    <FavoriteButton tdFileId={td.id} isFavorite={!!td.isFavorite} />
                  </div>
                  <dl className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div>Matière : {td.subject?.name}</div>
                    <div>
                      Formation : {td.subject?.semester?.level?.formation.code} — {td.subject?.semester?.level?.name}
                    </div>
                    <div>Semestre : {td.subject?.semester?.name}</div>
                    <div>
                      Enseignant : {td.teacher ? `${td.teacher.user.firstName} ${td.teacher.user.lastName}` : "—"}
                    </div>
                    <div>
                      Publié le :{" "}
                      {td.publishedAt ? new Date(td.publishedAt).toLocaleDateString("fr-FR") : "—"}
                    </div>
                    <div>{td.downloadCount} téléchargement(s)</div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Link
                      to={`/fiches/${td.id}`}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Consulter
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownload(td.id)}
                      className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Télécharger
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Précédent
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Page {data.page} / {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
