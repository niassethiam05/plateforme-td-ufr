import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { DownloadHistoryItem, PaginatedResult } from "../types";

export function useDownloadHistory(page: number, pageSize = 12) {
  return useQuery({
    queryKey: ["download-history", page, pageSize],
    queryFn: async () =>
      (await api.get<PaginatedResult<DownloadHistoryItem>>("/downloads", { params: { page, pageSize } })).data,
    placeholderData: (previous) => previous,
  });
}
