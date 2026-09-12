import { createContext, useContext } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchInfo } from "@/api/info";

type Mode = "local" | "remote";

interface ApiPaths {
  miners: string;
  stats: (ip: string) => string;
  alertsHistory: string;
  config: {
    miners: string;
    settings: string;
  };
}

interface ModeContextValue {
  mode: Mode;
  boardId: string | undefined;
  apiPaths: ApiPaths;
  /** True once GET /api/info confirms this is remote-dashboard-api (as
   * opposed to dashboard-api, or not yet known -- false, not undefined,
   * while still loading, so nothing flashes as board-related before this
   * is settled). The only way to tell a board-shaped URL that's actually
   * meaningful (remote-dashboard-api does serve /api/{boardId}/*) apart
   * from a plain local typo that merely looks like one (dashboard-api has
   * no such routes, and would 404 for it the same way). Every consumer
   * that shows board-only chrome (the Sidebar's chip/nav lockout,
   * BoardLockedPage, per-board notification storage) gates on this. */
  isRemoteBackend: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export const useMode = (): ModeContextValue => {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
};

interface ModeProviderProps {
  mode: Mode;
  children: React.ReactNode;
}

export const ModeProvider = ({ mode, children }: ModeProviderProps) => {
  const { boardId } = useParams<{ boardId: string }>();

  const apiPaths: ApiPaths =
    mode === "remote" && boardId
      ? {
          miners: `/api/${boardId}/miners`,
          stats: (ip: string) => `/api/${boardId}/${ip}/stats`,
          alertsHistory: `/api/${boardId}/miners/alerts/history`,
          config: {
            miners: `/api/${boardId}/config/miners`,
            settings: `/api/${boardId}/config/settings`,
          },
        }
      : {
          miners: "/api/miners",
          stats: (ip: string) => `/api/miners/${ip}/stats`,
          alertsHistory: "/api/miners/alerts/history",
          config: {
            miners: "/api/config/miners",
            settings: "/api/config/settings",
          },
        };

  // Shares its cache entry (same "info" query key) with every other
  // GET /api/info consumer (useUiFeatures, useAppInfo) -- one network
  // fetch total, regardless of how many of them are mounted.
  const infoQuery = useQuery({
    queryKey: ["info"],
    queryFn: fetchInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const isRemoteBackend = infoQuery.data?.remote === true;

  return (
    <ModeContext.Provider value={{ mode, boardId, apiPaths, isRemoteBackend }}>
      {children}
    </ModeContext.Provider>
  );
};
