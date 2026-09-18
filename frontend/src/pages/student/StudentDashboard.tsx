import { Link } from "react-router-dom";
import { StatCard } from "../../components/StatCard";
import { Spinner } from "../../components/Spinner";
import { useAuthStore } from "../../store/useAuthStore";
import { useTdFiles } from "../../services/td";
import { useSubjects } from "../../services/academic";

export function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: latest, isLoading } = useTdFiles({ pageSize: 5 });
  const { data: subjects } = useSubjects();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Bienvenue, {user?.firstName}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {user?.formation
          ? `Retrouvez les dernières fiches publiées pour votre filière (${user.formation.name}${
              user.level ? ` — ${user.level.name}` : ""
            }).`
          : "Retrouvez les dernières fiches publiées sur la plateforme."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Fiches disponibles" value={latest?.total ?? "—"} />
        <StatCard label="Matières" value={subjects?.length ?? "—"} />
        <StatCard label="Formations" value="—" hint="Voir le catalogue" />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dernières fiches</h2>
          <Link to="/catalogue" className="text-sm font-medium text-brand-600 hover:underline">
            Voir tout le catalogue
          </Link>
        </div>

        {isLoading ? (
          <Spinner />
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {latest?.items.map((td) => (
              <li key={td.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <Link to={`/fiches/${td.id}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">
                    {td.title}
                  </Link>
                  <p className="text-xs text-slate-400">{td.subject?.name}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {td.publishedAt && new Date(td.publishedAt).toLocaleDateString("fr-FR")}
                </span>
              </li>
            ))}
            {latest && latest.items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">Aucune fiche publiée pour le moment.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
