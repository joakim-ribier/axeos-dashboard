// src/hooks/useMiners.ts
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { MinerInfo } from "@/types/miner";

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

interface MinersResult {
  miners: Miner[];
  buildSHA?: string;
}

export const fetchMiners = async (url: string): Promise<MinersResult> => {
  try {
    const { data } = await axios.get<{
      configured: number;
      total: number;
      miners: MinerInfo[];
      buildSHA?: string;
    }>(url);
    return {
      miners: data.miners.map((raw) => minerSchema.parse(raw)),
      buildSHA: data.buildSHA,
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
  buildSHA: string | undefined;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

export const useMiners = (): UseMinersReturn => {
  const { apiPaths } = useMode();

  const query = useQuery<MinersResult, Error>({
    queryKey: ["miners", apiPaths.miners],
    queryFn: () => fetchMiners(apiPaths.miners),
    staleTime: Infinity,
    // Polled so a tab left open keeps catching new threshold-crossing
    // notifications (see minerNotifications.ts) rather than only fetching
    // once at page load.
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) =>
      err instanceof ApiError && err.status === 404 ? false : failureCount < 2,
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

/**
 * Standalone build-SHA lookup for the Sidebar, which renders above the
 * routing tree and therefore has no access to ModeProvider. Derives the
 * miners API path directly from the URL instead, and shares its cache entry
 * with useMiners() via the same query key — no duplicate network fetch.
 */
export const useBuildSHA = (): string | undefined => {
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

  return query.data?.buildSHA;
};
