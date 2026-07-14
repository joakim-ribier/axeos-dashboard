// src/hooks/useMinerStats.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { MinerInfo } from "@/types/miner";

interface FetchMinerStatsResponse {
  total: number;
  data: MinerInfo[];
}

const fetchMinerStats = async (url: string): Promise<MinerInfo[]> => {
  const { data } = await axios.get<FetchMinerStatsResponse>(url);
  return data.data;
};

export interface UseMinerStatsReturn {
  data: MinerInfo[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useMinerStats = (
  ip: string,
  enabled: boolean,
): UseMinerStatsReturn => {
  const { apiPaths } = useMode();
  const url = apiPaths.stats(ip);

  const query = useQuery<MinerInfo[], Error>({
    queryKey: ["miner-stats", url],
    queryFn: () => fetchMinerStats(url),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: enabled && !!ip,
  });

  return {
    ...query,
    refetch: async () => {
      await query.refetch();
    },
  };
};
