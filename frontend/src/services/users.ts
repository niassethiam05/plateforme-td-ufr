import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AdminUserRow, Role } from "../types";

/**
 * "PENDING" n'est pas un Role mais un filtre serveur sur les comptes
 * enseignants en attente de validation. Il est type a part pour que le
 * `role` du formulaire de selection reste aligne sur les valeurs acceptees
 * par le backend.
 */
export type UserListFilter = Role | "PENDING" | undefined;

export function useUsers(filter?: UserListFilter) {
  return useQuery({
    queryKey: ["users", filter ?? "all"],
    queryFn: async () =>
      (await api.get<AdminUserRow[]>("/users", { params: filter ? { role: filter } : {} })).data,
  });
}

/**
 * Nombre de comptes en attente de validation, pour le badge du filtre.
 *
 * La cle de cache est volontairement distincte de celle de useUsers("PENDING") :
 * React Query identifie une requete par sa cle, donc partager ["users","PENDING"]
 * entre une liste et un compteur les melangerait — la page recevrait un nombre
 * la ou elle attend un tableau, et `users.map(...)` echouerait. Deux formes de
 * donnees incompatibles doivent avoir deux cles.
 */
export function usePendingUserCount() {
  return useQuery({
    queryKey: ["users", "PENDING", "count"],
    queryFn: async () =>
      (await api.get<AdminUserRow[]>("/users", { params: { role: "PENDING" } })).data.length,
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await api.patch(`/users/${id}/active`, { isActive })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
