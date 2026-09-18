import { useState } from "react";
import { Table } from "../../components/Table";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { useSetUserActive, useUsers } from "../../services/users";
import { toastError, toastSuccess } from "../../store/useToastStore";
import type { Role } from "../../types";

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Étudiant",
  TEACHER: "Enseignant",
  ADMIN: "Administrateur",
};

export function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const { data: users, isLoading } = useUsers(roleFilter === "ALL" ? undefined : roleFilter);
  const setActive = useSetUserActive();

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await setActive.mutateAsync({ id, isActive: !isActive });
      toastSuccess(!isActive ? "Compte réactivé." : "Compte désactivé.");
    } catch {
      toastError("Impossible de mettre à jour ce compte.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Étudiants, enseignants et administrateurs de la plateforme.
          </p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "ALL")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="ALL">Tous les rôles</option>
          <option value="STUDENT">Étudiants</option>
          <option value="TEACHER">Enseignants</option>
          <option value="ADMIN">Administrateurs</option>
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !users || users.length === 0 ? (
          <EmptyState title="Aucun utilisateur" />
        ) : (
          <Table columns={["Nom", "Email", "Rôle", "Détail", "Statut", ""]}>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {u.firstName} {u.lastName}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {u.student ? `${u.student.formation.code} — ${u.student.level.name}` : ""}
                  {u.teacher ? u.teacher.department ?? "—" : ""}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {u.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.role !== "ADMIN" && (
                    <button
                      type="button"
                      onClick={() => toggleActive(u.id, u.isActive)}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {u.isActive ? "Désactiver" : "Réactiver"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
