// src/hooks/useAlertsHistory.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import {
  type AlertHistoryResponse,
  alertHistoryResponseSchema,
} from "@/schemas/minerSchema";

export interface AlertHistoryFilters {
  page: number;
  pageSize: number;
  ip?: string;
  type?: string;
  // YYYY-MM-DD, matching the daily JSONL filenames -- see
  // handler.parseDateFilter. Required, not optional: the server rejects a
  // request with no date (400) rather than scanning every day a miner has
  // ever recorded.
  date: string;
}

// The server also accepts sortBy/sortDir (see handler.ListAlertsHistory),
// but the Alerts page deliberately sorts client-side over whichever page
// is already loaded instead of using them -- sorting shouldn't cost a
// round trip just to reorder rows already on screen.
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
 * The paginated alert history for one day (GET
 * /api/{boardId?}/miners/alerts/history) -- unlike useAlerts' endpoint,
 * which is scoped to "recent, for the notification bell", this covers every
 * miner's alerts on the requested day. Backs the dedicated Alerts page.
 *
 * keepPreviousData: page/filter changes swap out `filters`, which changes
 * the query key -- without this, the list would flash to a loading state
 * on every click instead of staying on the current page's rows until the
 * next page's have arrived.
 *
 * No refetchInterval, unlike useMiners/useAlerts -- this is history, not a
 * live view: it only needs to be fetched when the page is (re)opened or a
 * filter/page changes, never on a timer just because auto-refresh happens
 * to be on.
 *
 * enabled: !!filters.date -- date is required by the API (a request without
 * one 400s), so this is a hard backstop against ever firing the request
 * without one, no matter what UI state produced an empty string (a caller
 * bug, a bad intermediate value while a date field is being edited, etc.).
 */
export const useAlertsHistory = (filters: AlertHistoryFilters) => {
  const { apiPaths } = useMode();

  return useQuery<AlertHistoryResponse, Error>({
    queryKey: ["alertsHistory", apiPaths.alertsHistory, filters],
    queryFn: () => fetchAlertsHistory(apiPaths.alertsHistory, filters),
    enabled: !!filters.date,
    staleTime: Infinity,
    // Same reasoning as useMiners: staleTime: Infinity alone would keep
    // serving whatever was cached from the first visit on every later
    // mount (e.g. navigating away and back). This makes arriving on the
    // Alerts page always fetch current data, regardless of how you got
    // there.
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData,
  });
};
