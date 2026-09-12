// src/hooks/useMiners.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { type AppVersionStatus, fetchInfo, type InfoResult } from "@/api/info";
import { useMode } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { MinerInfo } from "@/types/miner";
import { DEFAULT_UI_FEATURES, UIFeatures } from "@/types/uiFeatures";

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

export interface AppInfo {
  buildSHA: string | undefined;
  versionStatus: AppVersionStatus;
  releaseUrl: string | null;
  hashboardUrl: string | null;
  isPublic: boolean;
  /** True once the URL's board id is confirmed not to exist (the miners
   * fetch above came back 404) -- lets the Sidebar tell a genuinely
   * unknown board apart from a private one it just can't see into (403),
   * which still renders the normal board chrome. */
  boardNotFound: boolean;
  /** True when this board is private (403) and we're locked out of it --
   * every page under it (Home/Alerts/Settings) would show the same
   * request-access screen, so the Sidebar disables navigating between them
   * instead of offering links that just lead to more of the same. A plain
   * "page not found" (404, or any other unmatched path) never blocks the
   * Sidebar -- Home/Alerts/Settings are still real, useful destinations to
   * navigate to from there. */
  boardBlocked: boolean;
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
 * Build/version-status/hashboard-link lookup for the Sidebar.
 *
 * Deliberately two separate queries:
 * - /api/info is never board-gated (it's server-instance metadata, not
 *   board data — see internal/handler/info.go), so it stays available even
 *   when the visitor has no access to a private board.
 * - the board's own public/private flag IS board data, so it still comes
 *   from the miners endpoint (apiPaths.miners, from ModeContext), sharing
 *   its cache entry with useMiners() via the same query key — no duplicate
 *   network fetch. When that fetch fails (private board, no session),
 *   isPublic just falls back to false — acceptable since the locked-board
 *   page already makes the privacy state obvious.
 */
export const useAppInfo = (): AppInfo => {
  const { boardId, apiPaths, isRemoteBackend } = useMode();
  const minersPath = apiPaths.miners;

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
    // Gates every board-flavored inference below: a 404/403 only means
    // "this board" when ModeContext has already confirmed (via
    // /api/info) that this backend serves board routes at all.
    boardNotFound:
      isRemoteBackend &&
      Boolean(boardId) &&
      minersQuery.error instanceof ApiError &&
      minersQuery.error.status === 404,
    boardBlocked:
      isRemoteBackend &&
      Boolean(boardId) &&
      minersQuery.error instanceof ApiError &&
      minersQuery.error.status === 403,
  };
};
