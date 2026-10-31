// src/hooks/useAlertsHistory.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import {
  type AlertHistoryResponse,
  alertHistoryResponseSchema,
} from "@/schemas/minerSchema";

// The local dashboard's alert history -- a board has none.
const ALERTS_HISTORY_PATH = "/api/miners/alerts/history";

export interface AlertHistoryFilters {
  page: number;
  pageSize: number;
  ip?: string;
  type?: string;
  // The UTC day, YYYY-MM-DD -- required by the server (400 without one).
  date: string;
}

export const fetchAlertsHistory = async (
  url: string,
  filters: AlertHistoryFilters,
): Promise<AlertHistoryResponse> => {
  const { data } = await axios.get<unknown>(url, {
    params: {
      page: filters.page,
      pageSize: filters.pageSize,
      ip: filters.ip || undefined,
      type: filters.type || undefined,
      date: filters.date,
    },
  });
  return alertHistoryResponseSchema.parse(data);
};

/**
 * One day's alerts raised and cleared, paginated (GET
 * /api/miners/alerts/history) -- the Alerts page.
 *
 * keepPreviousData: page/filter changes swap out `filters`, which changes
 * the query key -- without this, the list would flash to a loading state
 * on every click instead of staying on the current page's rows until the
 * next page's have arrived.
 *
 * With auto-refresh on, fetched again every 90s so the day's new changes
 * show up -- only while the Alerts page is open (the timer stops with its
 * last observer) and its tab visible.
 * */
export const useAlertsHistory = (filters: AlertHistoryFilters) => {
  const { autoRefreshEnabled } = useRefreshSettings();

  return useQuery<AlertHistoryResponse, Error>({
    queryKey: ["alertsHistory", ALERTS_HISTORY_PATH, filters],
    queryFn: () => fetchAlertsHistory(ALERTS_HISTORY_PATH, filters),
    staleTime: Infinity,
    // Same reasoning as useMiners: staleTime: Infinity alone would keep
    // serving whatever was cached from the first visit on every later
    // mount (e.g. navigating away and back). This makes arriving on the
    // Alerts page always fetch current data, regardless of how you got
    // there.
    refetchOnMount: "always",
    refetchInterval: autoRefreshEnabled ? 90_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData,
  });
};
