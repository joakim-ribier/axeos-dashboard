// src/hooks/useServicesStatus.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";

import { useMode } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";

const serviceStateSchema = z.enum(["ok", "late", "offline", "unknown"]);

const serviceStatusSchema = z.object({
  state: serviceStateSchema,
  interval: z.string().optional(),
  lastRunAt: z.string().optional(),
  startedAt: z.string().optional(),
  version: z.string().optional(),
});

const servicesStatusSchema = z.object({
  checkedAt: z.string(),
  services: z.object({
    dashboardApi: serviceStatusSchema,
    feeder: serviceStatusSchema,
    healthCheck: serviceStatusSchema,
    mailer: serviceStatusSchema,
    firmwareCache: serviceStatusSchema,
  }),
  remotePushConfigured: z.boolean(),
});

export type ServiceState = z.infer<typeof serviceStateSchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type ServicesStatus = z.infer<typeof servicesStatusSchema>;
export type ServiceKey = keyof ServicesStatus["services"];

const fetchServicesStatus = async (): Promise<ServicesStatus> => {
  const { data } = await axios.get("/api/status");
  return servicesStatusSchema.parse(data);
};

/** How every process of this dashboard is doing (GET /api/status).
 * Refreshed with the rest of the page, as the auto-refresh switch says. */
export const useServicesStatus = () => {
  const { mode } = useMode();
  const { autoRefreshEnabled } = useRefreshSettings();
  return useQuery<ServicesStatus, Error>({
    queryKey: ["servicesStatus"],
    queryFn: fetchServicesStatus,
    // remote-dashboard-api has no /api/status, and a board's home page
    // reads this too (through useRemoteBoard).
    enabled: mode === "local",
    // Read by the sidebar card in both drawers (desktop and phone): one
    // answer serves them all.
    staleTime: 15_000,
    refetchInterval: autoRefreshEnabled ? 30_000 : false,
    refetchOnWindowFocus: false,
    retry: false,
  });
};
