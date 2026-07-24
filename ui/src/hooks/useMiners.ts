// src/hooks/useMiners.ts
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { MinerInfo } from "@/types/miner";

import { type Miner, minerSchema } from "../schemas/minerSchema";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Only set on the "board is private" 403 (see RequireBoardAccess on the
    // Go side) — the request that would normally carry it (a successful
    // MinersResponse) never got a chance to run, so it's echoed on the
    // error body instead. Lets BoardLockedPage build its form/link even
    // though the miners fetch itself failed.
    public readonly hashboardUrl: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type AppVersionStatus = "unknown" | "upToDate" | "updateAvailable";

interface MinersResult {
  miners: Miner[];
  buildSHA?: string;
  appVersionStatus: AppVersionStatus;
  appVersionReleaseURL: string | null;
  hashboardUrl: string | null;
  isPublic: boolean;
}

export const fetchMiners = async (url: string): Promise<MinersResult> => {
  try {
    const { data } = await axios.get<{
      configured: number;
      total: number;
      miners: MinerInfo[];
      buildSHA?: string;
      appVersionStatus?: AppVersionStatus;
      appVersionReleaseURL?: string;
      hashboardURL?: string;
      boardPublic?: boolean;
    }>(url);
    return {
      miners: data.miners.map((raw) => minerSchema.parse(raw)),
      buildSHA: data.buildSHA,
      appVersionStatus: data.appVersionStatus ?? "unknown",
      appVersionReleaseURL: data.appVersionReleaseURL ?? null,
      hashboardUrl: data.hashboardURL ?? null,
      isPublic: data.boardPublic ?? false,
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new ApiError(
        err.response.status,
        err.response.data?.error ?? err.message,
        err.response.data?.hashboardURL ?? null,
      );
    }
    throw err;
  }
};

export interface UseMinersReturn {
  data: Miner[] | undefined;
  buildSHA: string | undefined;
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
    buildSHA: query.data?.buildSHA,
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
}

/**
 * Standalone build/version-status lookup for the Sidebar, which renders
 * above the routing tree and therefore has no access to ModeProvider.
 * Derives the miners API path directly from the URL instead, and shares
 * its cache entry with useMiners() via the same query key — no duplicate
 * network fetch. The app-update check itself runs server-side (see
 * internal/appversion in the Go backend) and just rides along in this
 * same, already-polled response — no separate client-side GitHub call.
 */
export const useAppInfo = (): AppInfo => {
  const location = useLocation();
  const boardId = location.pathname.slice(1) || undefined;
  const minersPath = boardId ? `/api/${boardId}/miners` : "/api/miners";

  const query = useQuery<MinersResult, Error>({
    queryKey: ["miners", minersPath],
    queryFn: () => fetchMiners(minersPath),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    buildSHA: query.data?.buildSHA,
    versionStatus: query.data?.appVersionStatus ?? "unknown",
    releaseUrl: query.data?.appVersionReleaseURL ?? null,
    hashboardUrl: query.data?.hashboardUrl ?? null,
    isPublic: query.data?.isPublic ?? false,
  };
};
