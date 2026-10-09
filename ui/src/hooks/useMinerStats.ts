// src/hooks/useMinerStats.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { MinerInfo } from "@/types/miner";

interface FetchMinerStatsResponse {
  total: number;
  data: MinerInfo[];
}

/** The last 24h of full-resolution samples for one miner. */
export const useMinerStats = (ip: string) => {
  const { apiPaths } = useMode();
  const url = apiPaths.stats(ip);

  return useQuery<MinerInfo[], Error>({
    queryKey: ["miner-stats", url],
    queryFn: async () =>
      (await axios.get<FetchMinerStatsResponse>(url)).data.data,
    // Reopening a miner's panel after a poll cycle shows the new samples,
    // switching back and forth between miners doesn't refetch each time.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
};
