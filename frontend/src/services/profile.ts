import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AuthUser } from "../types";
import { useAuthStore } from "../store/useAuthStore";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get<AuthUser>("/profile")).data,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: { firstName: string; lastName: string; department?: string }) =>
      (await api.patch<AuthUser>("/profile", input)).data,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      // Garde la session (nom affiche dans la navbar, etc.) synchronisee.
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) setAuth(updated, accessToken);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) =>
      api.patch("/profile/password", input),
  });
}
