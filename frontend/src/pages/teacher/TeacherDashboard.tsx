import { Link } from "react-router-dom";
import { StatCard } from "../../components/StatCard";
import { Spinner } from "../../components/Spinner";
import { useAuthStore } from "../../store/useAuthStore";
import { useTeacherStats } from "../../services/stats";

export function TeacherDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading } = useTeacherStats();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Bienvenue, {user?.firstName}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Publiez et gérez vos fiches de TD.{" "}
        <Link to="/teacher/fiches/ajouter" className="font-medium text-brand-600 hover:underline">
          Ajouter une fiche
        </Link>
      </p>

      {isLoading || !stats ? (
        <Spinner />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Fiches publiées" value={stats.published} />
          <StatCard label="En attente de validation" value={stats.pending} />
          <StatCard label="Refusées" value={stats.rejected} />
          <StatCard label="Téléchargements (total)" value={stats.totalDownloads} />
        </div>
      )}
    </div>
  );
}
