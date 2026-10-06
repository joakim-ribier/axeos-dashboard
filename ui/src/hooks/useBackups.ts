// src/hooks/useBackups.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { type Backup, backupsResponseSchema } from "@/schemas/backupSchema";

const BACKUPS_URL = "/api/backups";

export const backupsDownloadUrl = (months: string[]) =>
  `${BACKUPS_URL}/download?months=${months.join(",")}`;

const fetchBackups = async (): Promise<Backup[]> => {
  const { data } = await axios.get(BACKUPS_URL);
  return backupsResponseSchema.parse(data).data;
};

export const useBackups = () =>
  useQuery<Backup[], Error>({
    queryKey: ["backups"],
    queryFn: fetchBackups,
    refetchOnWindowFocus: false,
    retry: false,
  });
