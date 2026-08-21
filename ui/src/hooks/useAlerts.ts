// src/hooks/useAlerts.ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import axios from "axios";

import { useNotifications } from "@/contexts/NotificationsContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { fetchMiners, type MinersResult } from "@/hooks/useMiners";
import { boardIdFromPathname } from "@/utils/boardId";
import { resolvedAlertsToNotifications } from "@/utils/minerNotifications";

import {
  type AlertEntry,
  alertEntrySchema,
  type Miner,
} from "../schemas/minerSchema";

const ALERTS_LIMIT = 10;

export const fetchAlerts = async (url: string): Promise<AlertEntry[]> => {
  const { data } = await axios.get<unknown[]>(url, {
    params: { limit: ALERTS_LIMIT },
  });
  return data.map((raw) => alertEntrySchema.parse(raw));
};

/**
 * The alert *history* (temp/fan/offline/mismatch/firmware), computed by the
 * feeder on every poll and stored regardless of whether anyone's watching
 * -- see server/internal/model/alert.go. `limit` is applied per miner
 * server-side (see handler.ListAlerts), so a chatty miner can't push
 * another miner's still-active alert out of the response. This alone can't
 * tell whether something is *still* active though (see
 * minerNotifications.currentAlertState) -- it's only used here to find out
 * when a since-resolved alert was last seen, for useAlertResolutionEffect.
 *
 * Derives boardId from the URL directly rather than ModeContext -- this
 * hook is consumed by TopBar, which (like Sidebar) is mounted above the
 * routing tree and therefore above ModeProvider (see App.tsx).
 */
const useAlertsHistoryQuery = (): UseQueryResult<AlertEntry[], Error> => {
  const location = useLocation();
  const boardId = boardIdFromPathname(location.pathname);
  const alertsPath = boardId
    ? `/api/${boardId}/miners/alerts`
    : "/api/miners/alerts";
  const { autoRefreshEnabled } = useRefreshSettings();

  return useQuery<AlertEntry[], Error>({
    queryKey: ["alerts", alertsPath],
    queryFn: () => fetchAlerts(alertsPath),
    staleTime: Infinity,
    refetchInterval: autoRefreshEnabled ? 90_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

/**
 * The live miners list, for currently-active alerts (see
 * minerNotifications.currentAlertState for why this, not the alert
 * history, is the only reliable "is it happening right now" source).
 * Fetched independently of ModeContext for the same reason as the history
 * query above, but sharing its query key with useMiners() (see
 * useAppInfo's identical pattern) -- pages that already fetch the miners
 * list don't pay for a second network round trip just because the bell is
 * also mounted.
 */
const useCurrentMinersQuery = (): UseQueryResult<MinersResult, Error> => {
  const location = useLocation();
  const boardId = boardIdFromPathname(location.pathname);
  const minersPath = boardId ? `/api/${boardId}/miners` : "/api/miners";
  const { autoRefreshEnabled } = useRefreshSettings();

  return useQuery<MinersResult, Error>({
    queryKey: ["miners", minersPath],
    queryFn: () => fetchMiners(minersPath),
    staleTime: Infinity,
    // Explicit, rather than relying on useMiners() (Home.tsx) sharing this
    // same query key to keep the cache warm -- the bell is mounted above
    // the routing tree and must stay correct even on a route or state where
    // nothing else happens to be polling this query.
    refetchInterval: autoRefreshEnabled ? 90_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

export const useActiveAlerts = (): Miner[] =>
  useCurrentMinersQuery().data?.miners ?? [];

/**
 * Feeds "resolved" notifications into NotificationsContext -- an alert
 * *starting* doesn't need this, it's already shown live by
 * activeAlertsToNotifications (via useActiveAlerts); this only records the
 * other edge, the one piece of history that isn't otherwise recoverable
 * once it's happened (the server only stores alert-bearing lines, so
 * there's no "and now it's fine" line to look back at later).
 *
 * Deliberately stateless: resolvedAlertsToNotifications reconstructs
 * resolved episodes from the history + live miners state alone (see its
 * own doc comment), so there's no "previous snapshot" to track here --
 * every fetch just re-derives the answer from scratch, and
 * NotificationsContext's own id dedup keeps that idempotent. Meant to be
 * mounted once (TopBar's NotificationBell) so it keeps running regardless
 * of which page is open.
 */
export const useAlertResolutionEffect = (): void => {
  const { data: history } = useAlertsHistoryQuery();
  const { data: minersResult } = useCurrentMinersQuery();
  const { addNotifications } = useNotifications();

  useEffect(() => {
    if (!history || !minersResult) return;
    addNotifications(
      resolvedAlertsToNotifications(history, minersResult.miners),
    );
  }, [history, minersResult, addNotifications]);
};
