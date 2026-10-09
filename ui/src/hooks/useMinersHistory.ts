import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { type MinersHistory, minersHistorySchema } from "@/schemas/minerSchema";

/** Last 24h of every miner, in 15-minute buckets -- feeds the fleet chart
 * and the per-miner sparklines. */
export const useMinersHistory = () => {
  const { apiPaths } = useMode();
  const { autoRefreshEnabled } = useRefreshSettings();

  return useQuery<MinersHistory, Error>({
    queryKey: ["miners-history", apiPaths.history],
    queryFn: async () =>
      minersHistorySchema.parse((await axios.get(apiPaths.history)).data),
    staleTime: Infinity,
    // A new point only appears every 15 minutes -- no need to follow the
    // miners list's faster refresh.
    refetchInterval: autoRefreshEnabled ? 5 * 60_000 : false,
    refetchOnWindowFocus: false,
  });
};
