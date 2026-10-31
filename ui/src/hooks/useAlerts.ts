// src/hooks/useAlerts.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";

import {
  type AlertEvent,
  alertEventSchema,
  type AlertsResponse,
  alertsResponseSchema,
} from "../schemas/minerSchema";

// Local only: the bell lives in the local dashboard's top bar.
const ALERTS_PATH = "/api/miners/alerts";
const ALERTS_KEY = ["alerts", ALERTS_PATH];

export const fetchAlerts = async (): Promise<AlertsResponse> => {
  const { data } = await axios.get<unknown>(ALERTS_PATH);
  return alertsResponseSchema.parse(data);
};

/** The most recent alerts raised or cleared, most recent first, and up to
 * when they've been read -- the bell's content. */
export const useAlerts = () => {
  const { autoRefreshEnabled } = useRefreshSettings();

  return useQuery<AlertsResponse, Error>({
    queryKey: ALERTS_KEY,
    queryFn: fetchAlerts,
    staleTime: Infinity,
    refetchInterval: autoRefreshEnabled ? 90_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
  });
};

const ACTIVE_ALERTS_PATH = `${ALERTS_PATH}/active`;

export const fetchActiveAlerts = async (): Promise<AlertEvent[]> => {
  const { data } = await axios.get<unknown[]>(ACTIVE_ALERTS_PATH);
  return data.map((raw) => alertEventSchema.parse(raw));
};

/** The alerts in progress, however long ago they were raised -- the
 * sidebar's badge and the top of the Alerts page. */
export const useActiveAlerts = () => {
  const { autoRefreshEnabled } = useRefreshSettings();

  return useQuery<AlertEvent[], Error>({
    queryKey: ["alerts", ACTIVE_ALERTS_PATH],
    queryFn: fetchActiveAlerts,
    staleTime: Infinity,
    refetchInterval: autoRefreshEnabled ? 90_000 : false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
  });
};

/** Marks the alerts read up to a time (ms) -- on the server, so for every
 * browser. */
export const useMarkAlertsSeen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timestamp: number) => {
      const { data } = await axios.post<{ seenAt: string }>(
        `${ALERTS_PATH}/seen`,
        { seenAt: new Date(timestamp).toISOString() },
      );
      return data.seenAt;
    },
    onSuccess: (seenAt) =>
      queryClient.setQueryData<AlertsResponse>(
        ALERTS_KEY,
        (current) => current && { ...current, seenAt },
      ),
  });
};
