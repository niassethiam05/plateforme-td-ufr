import { Link } from "react-router-dom";
import { StatCard } from "../../components/StatCard";
import { useFormations, useLevels, useSubjects } from "../../services/academic";
import { useTdFiles } from "../../services/td";

export function HomePage() {
  const { data: formations } = useFormations();
  const { data: levels } = useLevels();
  const { data: subjects } = useSubjects();
  const { data: tdFiles } = useTdFiles({ pageSize: 1 });

  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Fiches de TD de votre UFR, accessibles partout.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Retrouvez facilement vos supports de Travaux Dirigés, organisés par
          formation, niveau et matière.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/catalogue"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Explorer les fiches
          </Link>
          <Link
            to="/connexion"
            className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Se connecter
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Fiches disponibles" value={tdFiles?.total ?? "—"} />
          <StatCard label="Matières" value={subjects?.length ?? "—"} />
          <StatCard label="Formations" value={formations?.length ?? "—"} />
          <StatCard label="Niveaux" value={levels?.length ?? "—"} />
        </div>
      </section>
    </div>
  );
}
