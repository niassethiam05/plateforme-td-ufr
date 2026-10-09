import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { PaginatedResult, TdFile } from "../types";

export interface TdFileFilters {
  search?: string;
  formationId?: string;
  levelId?: string;
  semesterId?: string;
  subjectId?: string;
  teacherId?: string;
  academicYearId?: string;
  status?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export function useTdFiles(filters: TdFileFilters) {
  return useQuery({
    queryKey: ["td-files", filters],
    queryFn: async () =>
      (await api.get<PaginatedResult<TdFile>>("/td", { params: filters })).data,
    placeholderData: (previous) => previous,
  });
}

export function useTdFile(id: string | undefined) {
  return useQuery({
    queryKey: ["td-file", id],
    queryFn: async () => (await api.get<TdFile>(`/td/${id}`)).data,
    enabled: !!id,
  });
}

export interface CreateTdFilePayload {
  title: string;
  description?: string;
  subjectId: string;
  academicYearId: string;
  tdNumber?: number;
  file: File;
  coverImage?: File;
}

function toFormData(payload: CreateTdFilePayload) {
  const formData = new FormData();
  formData.append("title", payload.title);
  if (payload.description) formData.append("description", payload.description);
  formData.append("subjectId", payload.subjectId);
  formData.append("academicYearId", payload.academicYearId);
  if (payload.tdNumber !== undefined) formData.append("tdNumber", String(payload.tdNumber));
  formData.append("file", payload.file);
  if (payload.coverImage) formData.append("coverImage", payload.coverImage);
  return formData;
}

export function useCreateTdFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTdFilePayload) =>
      (await api.post<TdFile>("/td", toFormData(payload), {
        headers: { "Content-Type": "multipart/form-data" },
      })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["td-files"] }),
  });
}

export function useUpdateTdFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      description?: string;
      tdNumber?: number;
    }) => (await api.put<TdFile>(`/td/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["td-files"] }),
  });
}

export function useDeleteTdFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/td/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["td-files"] }),
  });
}

export function useSubmitTdFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<TdFile>(`/td/${id}/submit`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["td-files"] }),
  });
}

export function useDecideTdFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve, adminComment }: { id: string; approve: boolean; adminComment?: string }) =>
      (await api.post<TdFile>(`/td/${id}/decision`, { approve, adminComment })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["td-files"] }),
  });
}

/**
 * Obtient l'URL d'une ressource fichier (consultation ou telechargement).
 *
 * Le serveur renvoie une URL relative de meme origine + un jeton de portee
 * restreinte, court (120 s) et lie a la session. Le jeton passe en query string
 * car une requete subie par un `<iframe>` ou `window.open()` n'envoie pas
 * l'en-tete Authorization. Il n'est pas un jeton d'acces : le serveur le
 * re-verifie, ainsi que le compte et la visibilite de la fiche, a chaque
 * requete de flux.
 *
 * Resultat relatif (`/api/...`) : aucun nom d'hote de stockage n'est expose,
 * et la requete reste de meme origine (CSP `frame-src 'self'`).
 */
async function requestFileUrl(id: string, scope: "download" | "view"): Promise<string> {
  const { data } = await api.get<{ url: string; token: string }>(`/td/${id}/${scope}`);
  return `${data.url}?token=${encodeURIComponent(data.token)}`;
}

export function requestTdFileDownloadUrl(id: string) {
  return requestFileUrl(id, "download");
}

export function requestTdFileViewUrl(id: string) {
  return requestFileUrl(id, "view");
}
