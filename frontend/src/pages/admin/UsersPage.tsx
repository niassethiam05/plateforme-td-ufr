import { useState } from "react";
import { Table } from "../../components/Table";
import { EmptyState } from "../../components/EmptyState";
import { Spinner } from "../../components/Spinner";
import { usePendingUserCount, useSetUserActive, useUsers } from "../../services/users";
import { toastError, toastSuccess } from "../../store/useToastStore";
import type { AdminUserRow, Role } from "../../types";

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Étudiant",
  TEACHER: "Enseignant",
  ADMIN: "Administrateur",
};

/**
 * Trois etats distincts pour un compte inactif :
 * - "a valider" : enseignant jamais valide par l'administration (approvedAt null)
 * - "desactive"  : compte valide puis desactive (approvedAt renseigne)
 * - STUDENT      : desactive par l'administration, sans notion de validation
 */
function statusOf(u: AdminUserRow): { label: string; className: string } {
  if (u.isActive) {
    return {
      label: "Actif",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    };
  }
  if (u.role === "TEACHER" && !u.teacherApprovedAt) {
    return {
      label: "À valider",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    };
  }
  return {
    label: "Désactivé",
    className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };
}

export function UsersPage() {
  const [filter, setFilter] = useState<Role | "PENDING" | "ALL">("ALL");
  // Le filtrage est fait par le backend : "PENDING" est un filtre metier sur
  // teacherApprovedAt, pas un role, et le maintenir cote client obligerait a
  // telecharger la liste complete a chaque changement de filtre.
  const { data: users, isLoading } = useUsers(filter === "ALL" ? undefined : filter);
  // Requete separee pour le compteur du filtre "A valider" : elle doit rester
  // affichee quel que soit le filtre actif, et ne doit pas etre reexecutee a
  // chaque changement de role.
  const { data: pendingCount } = usePendingUserCount();
  const setActive = useSetUserActive();

  async function toggleActive(id: string, isActive: boolean, pendingApproval: boolean) {
    try {
      await setActive.mutateAsync({ id, isActive: !isActive });
      toastSuccess(
        pendingApproval && isActive
          ? "Compte enseignant validé. Il peut maintenant se connecter."
          : !isActive
            ? "Compte réactivé."
            : "Compte désactivé."
      );
    } catch (err) {
      // Le backend refuse l'auto-desactivation et la desactivation du dernier
      // admin : on affiche son message plutot qu'un echec generique, sans quoi
      // l'admin ne comprendrait pas pourquoi le bouton ne fait rien.
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        "Impossible de mettre à jour ce compte.";
      toastError(message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Étudiants, enseignants et administrateurs de la plateforme. Validez les comptes
            enseignants en attente pour leur donner accès.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Role | "PENDING" | "ALL")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="ALL">Tous les rôles</option>
          <option value="STUDENT">Étudiants</option>
          <option value="TEACHER">Enseignants</option>
          <option value="ADMIN">Administrateurs</option>
          {pendingCount ? (
            <option value="PENDING">À valider ({pendingCount})</option>
          ) : null}
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !users || users.length === 0 ? (
          <EmptyState
            title={filter === "PENDING" ? "Aucun compte à valider" : "Aucun utilisateur"}
          />
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
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusOf(u).className}`}
                  >
                    {statusOf(u).label}
                  </span>
                  {!u.isActive && u.role === "TEACHER" && !u.teacherApprovedAt && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")} — accès en attente
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Aucune action sur les comptes ADMIN : le desactiver est refuse par le
                      backend (auto-desactivation, et dernier admin actif).
                      On ne masque pas le bouton "pour un admin en
                      particulier" — le frontend ne sait pas de facon fiable
                      qui est l'appelant ni combien d'admins actifs il
                      reste. Le garde-fou reste donc uniquement cote serveur. */}
                  {u.role !== "ADMIN" && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleActive(
                          u.id,
                          u.isActive,
                          u.role === "TEACHER" && !u.teacherApprovedAt
                        )
                      }
                      className={`text-sm font-medium hover:underline ${
                        !u.isActive && u.role === "TEACHER" && !u.teacherApprovedAt
                          ? "text-amber-700 hover:text-amber-800 dark:text-amber-400"
                          : "text-brand-600"
                      }`}
                    >
                      {!u.isActive && u.role === "TEACHER" && !u.teacherApprovedAt
                        ? "Valider"
                        : u.isActive
                          ? "Désactiver"
                          : "Réactiver"}
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
