// src/schemas/backupSchema.ts
import { z } from "zod";

// Mirrors backup.Info (server/internal/backup/backup.go).
export const backupSchema = z.object({
  month: z.string(),
  size: z.number(),
  updatedAt: z.string(),
  checksum: z.string().optional(),
});

export const backupsResponseSchema = z.object({
  data: z.array(backupSchema),
});

export type Backup = z.infer<typeof backupSchema>;
