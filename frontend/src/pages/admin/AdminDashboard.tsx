import { StatCard } from "../../components/StatCard";
import { Spinner } from "../../components/Spinner";
import { useAuthStore } from "../../store/useAuthStore";
import { useAdminStats } from "../../services/stats";

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading } = useAdminStats();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Bienvenue, {user?.firstName}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Vue d'ensemble de la plateforme.
      </p>

      {isLoading || !stats ? (
        <Spinner />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Étudiants" value={stats.students} />
            <StatCard label="Enseignants" value={stats.teachers} />
            <StatCard label="Fiches publiées" value={stats.published} />
            <StatCard label="En attente de validation" value={stats.pending} hint="Voir Validation" />
            <StatCard label="Matières" value={stats.subjects} />
            <StatCard label="Téléchargements" value={stats.downloads} />
            <StatCard label="Fiches (total)" value={stats.tdFiles} />
            <StatCard label="Signalements en attente" value={stats.pendingReports} />
          </div>

          {stats.mostDownloaded.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Fiches les plus téléchargées
              </h2>
              <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {stats.mostDownloaded.map((td) => (
                  <li key={td.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{td.title}</span>
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      {td.downloadCount} téléchargements
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
