// src/schemas/auditSchema.ts
import { z } from "zod";

// Mirrors audit.Entry (server/internal/audit/audit.go).
export const auditEntrySchema = z.object({
  ts: z.string(),
  // "api" | "system" -- a plain string so one unexpected value (e.g. a log
  // line written by another version) doesn't fail the whole page.
  source: z.string(),
  type: z.string(),
  target: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  requestId: z.string().optional(),
  status: z.number().optional(),
  query: z.string().optional(),
  service: z.string().optional(),
  cron: z.string().optional(),
  error: z.string().optional(),
});

// Mirrors handler.AuditResponse.
export const auditResponseSchema = z.object({
  entries: z.array(auditEntrySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;
