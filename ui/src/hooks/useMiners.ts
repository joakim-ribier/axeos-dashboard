// src/hooks/useMiners.ts
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

const fetchMiners = async (url: string): Promise<Miner[]> => {
  try {
    const { data } = await axios.get<{
      configured: number;
      total: number;
      miners: MinerInfo[];
    }>(url);
    return data.miners.map((raw) => minerSchema.parse(raw));
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

  const query = useQuery<Miner[], Error>({
    queryKey: ["miners", apiPaths.miners],
    queryFn: () => fetchMiners(apiPaths.miners),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) =>
      err instanceof ApiError && err.status === 404 ? false : failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...query,
    refetch: async () => {
      await query.refetch();
    },
  };
};
