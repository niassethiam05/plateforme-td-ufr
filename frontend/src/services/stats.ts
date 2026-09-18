import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { AdminStats, TeacherStats } from "../types";

export function useAdminStats() {
  return useQuery({
    queryKey: ["stats", "admin"],
    queryFn: async () => (await api.get<AdminStats>("/stats/admin")).data,
  });
}

export function useTeacherStats() {
  return useQuery({
    queryKey: ["stats", "teacher"],
    queryFn: async () => (await api.get<TeacherStats>("/stats/teacher")).data,
  });
}
