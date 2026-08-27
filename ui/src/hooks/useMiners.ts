// src/hooks/useMiners.ts
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { MinerInfo } from "@/types/miner";
import { DEFAULT_UI_FEATURES, UIFeatures } from "@/types/uiFeatures";
import { boardIdFromPathname } from "@/utils/boardId";

import { type Miner, minerSchema } from "../schemas/minerSchema";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type AppVersionStatus = "unknown" | "upToDate" | "updateAvailable";

export interface MinersResult {
  miners: Miner[];
  isPublic: boolean;
}

export const fetchMiners = async (url: string): Promise<MinersResult> => {
  try {
    const { data } = await axios.get<{
      configured: number;
      total: number;
      miners: MinerInfo[];
      boardPublic?: boolean;
    }>(url);
    return {
      miners: data.miners.map((raw) => minerSchema.parse(raw)),
      isPublic: data.boardPublic ?? false,
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new ApiError(
        err.response.status,
        err.response.data?.error ?? err.message,
      );
    }
    throw err;
  }
};

export interface UseMinersReturn {
  data: Miner[] | undefined;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export const useMiners = (): UseMinersReturn => {
  const { apiPaths } = useMode();
  const { autoRefreshEnabled } = useRefreshSettings();

  const query = useQuery<MinersResult, Error>({
    queryKey: ["miners", apiPaths.miners],
    queryFn: () => fetchMiners(apiPaths.miners),
    staleTime: Infinity,
    // Polled so a tab left open keeps catching new threshold-crossing
    // notifications (see minerNotifications.ts) rather than only fetching
    // once at page load — unless the user turned auto-refresh off from
    // the Sidebar, in which case it only ever fetches once per mount.
    refetchInterval: autoRefreshEnabled ? 90_000 : false,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) =>
      err instanceof ApiError && (err.status === 404 || err.status === 403)
        ? false
        : failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...query,
    data: query.data?.miners,
    refetch: async () => {
      await query.refetch();
    },
  };
};

interface InfoResult {
  buildSHA?: string;
  appVersionStatus: AppVersionStatus;
  appVersionReleaseURL: string | null;
  hashboardUrl: string | null;
  ui: UIFeatures;
}

export const fetchInfo = async (): Promise<InfoResult> => {
  const { data } = await axios.get<{
    buildSHA?: string;
    appVersionStatus?: AppVersionStatus;
    appVersionReleaseURL?: string;
    hashboardURL?: string;
    ui?: UIFeatures;
  }>("/api/info");
  return {
    buildSHA: data.buildSHA,
    appVersionStatus: data.appVersionStatus ?? "unknown",
    appVersionReleaseURL: data.appVersionReleaseURL ?? null,
    hashboardUrl: data.hashboardURL ?? null,
    ui: data.ui ?? DEFAULT_UI_FEATURES,
  };
};

export interface AppInfo {
  buildSHA: string | undefined;
  versionStatus: AppVersionStatus;
  releaseUrl: string | null;
  hashboardUrl: string | null;
  isPublic: boolean;
}

export interface UseUiFeaturesReturn {
  ui: UIFeatures;
  /** True until GET /api/info's first response resolves -- see RequireSettingsEnabled, which waits for this instead of rendering the DEFAULT_UI_FEATURES fallback (everything enabled) and flashing content it may need to hide. */
  isLoading: boolean;
}

/**
 * UI feature flags from GET /api/info (see config.UIConfig) -- the single
 * React codebase shows everything by default and a page/action opts itself
 * out based on this instead of hardcoding local/remote-specific behavior.
 * Shares its cache entry with useAppInfo() (same "info" query key).
 */
export const useUiFeatures = (): UseUiFeaturesReturn => {
  const infoQuery = useQuery<InfoResult, Error>({
    queryKey: ["info"],
    queryFn: fetchInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return {
    ui: infoQuery.data?.ui ?? DEFAULT_UI_FEATURES,
    isLoading: infoQuery.isLoading,
  };
};

/**
 * Build/version-status/hashboard-link lookup for the Sidebar, which renders
 * above the routing tree and therefore has no access to ModeProvider.
 *
 * Deliberately two separate queries:
 * - /api/info is never board-gated (it's server-instance metadata, not
 *   board data — see internal/handler/info.go), so it stays available even
 *   when the visitor has no access to a private board.
 * - the board's own public/private flag IS board data, so it still comes
 *   from the miners endpoint, deriving the path from the URL directly
 *   (same reasoning as before) and sharing its cache entry with
 *   useMiners() via the same query key — no duplicate network fetch. When
 *   that fetch fails (private board, no session), isPublic just falls back
 *   to false — acceptable since the locked-board page already makes the
 *   privacy state obvious.
 */
export const useAppInfo = (): AppInfo => {
  const location = useLocation();
  const boardId = boardIdFromPathname(location.pathname);
  const minersPath = boardId ? `/api/${boardId}/miners` : "/api/miners";

  const infoQuery = useQuery<InfoResult, Error>({
    queryKey: ["info"],
    queryFn: fetchInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const minersQuery = useQuery<MinersResult, Error>({
    queryKey: ["miners", minersPath],
    queryFn: () => fetchMiners(minersPath),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    buildSHA: infoQuery.data?.buildSHA,
    versionStatus: infoQuery.data?.appVersionStatus ?? "unknown",
    releaseUrl: infoQuery.data?.appVersionReleaseURL ?? null,
    hashboardUrl: infoQuery.data?.hashboardUrl ?? null,
    isPublic: minersQuery.data?.isPublic ?? false,
  };
};
