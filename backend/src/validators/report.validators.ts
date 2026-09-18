import { z } from "zod";

export const createReportSchema = z.object({
  reason: z.string().min(1, "Le motif est requis").max(200),
  description: z.string().max(2000).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});

export const reportQuerySchema = z.object({
  status: z.enum(["PENDING", "RESOLVED", "DISMISSED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(15),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
