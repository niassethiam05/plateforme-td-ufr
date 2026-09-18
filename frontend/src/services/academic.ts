import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AcademicYear, Formation, Level, Semester, Subject } from "../types";

// --- Formations -------------------------------------------------------

export function useFormations() {
  return useQuery({
    queryKey: ["formations"],
    queryFn: async () => (await api.get<Formation[]>("/formations")).data,
  });
}

export function useCreateFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; code: string; description?: string }) =>
      (await api.post<Formation>("/formations", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formations"] }),
  });
}

export function useUpdateFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; code?: string; description?: string }) =>
      (await api.put<Formation>(`/formations/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formations"] }),
  });
}

export function useDeleteFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/formations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formations"] }),
  });
}

// --- Niveaux ------------------------------------------------------------

export function useLevels(formationId?: string) {
  return useQuery({
    queryKey: ["levels", formationId ?? "all"],
    queryFn: async () =>
      (await api.get<Level[]>("/levels", { params: formationId ? { formationId } : {} })).data,
    enabled: formationId === undefined || formationId.length > 0,
  });
}

export function useCreateLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { formationId: string; name: string; order?: number }) =>
      (await api.post<Level>("/levels", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["levels"] }),
  });
}

export function useUpdateLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; order?: number }) =>
      (await api.put<Level>(`/levels/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["levels"] }),
  });
}

export function useDeleteLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/levels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["levels"] }),
  });
}

// --- Années universitaires ----------------------------------------------

export function useAcademicYears() {
  return useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => (await api.get<AcademicYear[]>("/academic-years")).data,
  });
}

export function useCreateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
      (await api.post<AcademicYear>("/academic-years", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-years"] }),
  });
}

export function useDeleteAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/academic-years/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-years"] }),
  });
}

// --- Semestres ------------------------------------------------------------

export function useSemesters(levelId?: string) {
  return useQuery({
    queryKey: ["semesters", levelId ?? "all"],
    queryFn: async () =>
      (await api.get<Semester[]>("/semesters", { params: levelId ? { levelId } : {} })).data,
  });
}

export function useCreateSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { levelId: string; academicYearId: string; name: string; order?: number }) =>
      (await api.post<Semester>("/semesters", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["semesters"] }),
  });
}

export function useDeleteSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/semesters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["semesters"] }),
  });
}

// --- Matières ------------------------------------------------------------

export function useSubjects(semesterId?: string) {
  return useQuery({
    queryKey: ["subjects", semesterId ?? "all"],
    queryFn: async () =>
      (await api.get<Subject[]>("/subjects", { params: semesterId ? { semesterId } : {} })).data,
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      semesterId: string;
      name: string;
      code?: string;
      description?: string;
      mainTeacherId?: string;
    }) => (await api.post<Subject>("/subjects", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/subjects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}
