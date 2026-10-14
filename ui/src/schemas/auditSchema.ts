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
  // Before/after of each field a security-relevant entry changed -- both
  // absent for a value never written down (the remote push API key).
  changes: z
    .array(
      z.object({
        field: z.string(),
        // "changed" (before → after), or one list item "added" (after) or
        // "removed" (before).
        kind: z.string().optional(),
        before: z.string().optional(),
        after: z.string().optional(),
      }),
    )
    .optional(),
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

// Mirrors handler.AuditTypesResponse.
export const auditTypesResponseSchema = z.object({
  types: z.array(z.string()),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AuditResponse = z.infer<typeof auditResponseSchema>;
