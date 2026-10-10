// src/hooks/useAudit.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

import { type AuditResponse, auditResponseSchema } from "@/schemas/auditSchema";

const AUDIT_URL = "/api/audit";

export interface AuditFilters {
  page: number;
  pageSize: number;
  // RFC 3339 bounds -- both left out means the server's default window,
  // the last 24 hours.
  from?: string;
  to?: string;
  // A miner's IP -- also matches a pool switch applied to every miner.
  ip?: string;
  type?: string;
}

// The filters minus pagination -- what an export covers.
export type AuditRange = Omit<AuditFilters, "page" | "pageSize">;

export const auditExportUrl = (range: AuditRange) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(range)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${AUDIT_URL}/export${query ? `?${query}` : ""}`;
};

const fetchAudit = async (filters: AuditFilters): Promise<AuditResponse> => {
  const { data } = await axios.get<unknown>(AUDIT_URL, { params: filters });
  return auditResponseSchema.parse(data);
};

// Same caching as useAlertsHistory: history, not a live view -- fetched on
// arrival and on a filter/page change, never on a timer.
export const useAudit = (filters: AuditFilters) =>
  useQuery<AuditResponse, Error>({
    queryKey: ["audit", filters],
    queryFn: () => fetchAudit(filters),
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData,
  });
