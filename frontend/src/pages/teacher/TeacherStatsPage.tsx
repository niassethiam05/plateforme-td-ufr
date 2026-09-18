import { StatCard } from "../../components/StatCard";
import { Spinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { useTeacherStats } from "../../services/stats";

export function TeacherStatsPage() {
  const { data: stats, isLoading } = useTeacherStats();

  if (isLoading || !stats) return <Spinner />;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Statistiques</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Fiches (total)" value={stats.total} />
        <StatCard label="Publiées" value={stats.published} />
        <StatCard label="En attente" value={stats.pending} />
        <StatCard label="Téléchargements (total)" value={stats.totalDownloads} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fiches les plus populaires</h2>
        {stats.mostPopular.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Pas encore de téléchargements" />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {stats.mostPopular.map((td) => (
              <li key={td.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{td.title}</span>
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  {td.downloadCount} téléchargements
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
