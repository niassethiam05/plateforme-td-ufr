import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AdminUserRow, Role } from "../types";

export function useUsers(role?: Role) {
  return useQuery({
    queryKey: ["users", role ?? "all"],
    queryFn: async () =>
      (await api.get<AdminUserRow[]>("/users", { params: role ? { role } : {} })).data,
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
