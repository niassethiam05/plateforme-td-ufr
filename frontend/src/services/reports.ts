import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { PaginatedResult, Report, ReportStatus } from "../types";

export function useCreateReport() {
  return useMutation({
    mutationFn: async ({
      tdFileId,
      reason,
      description,
    }: {
      tdFileId: string;
      reason: string;
      description?: string;
    }) => (await api.post<Report>(`/reports/${tdFileId}`, { reason, description })).data,
  });
}

export function useReports(status?: ReportStatus) {
  return useQuery({
    queryKey: ["reports", status],
    queryFn: async () =>
      (await api.get<PaginatedResult<Report>>("/reports", { params: { status, pageSize: 50 } })).data,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "RESOLVED" | "DISMISSED" }) =>
      (await api.patch<Report>(`/reports/${id}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}
