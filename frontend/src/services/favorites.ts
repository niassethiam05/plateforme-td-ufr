import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { TdFile } from "../types";

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => (await api.get<TdFile[]>("/favorites")).data,
  });
}

export function useAddFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tdFileId: string) => api.post(`/favorites/${tdFileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["td-files"] });
      qc.invalidateQueries({ queryKey: ["td-file"] });
    },
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tdFileId: string) => api.delete(`/favorites/${tdFileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["td-files"] });
      qc.invalidateQueries({ queryKey: ["td-file"] });
    },
  });
}
