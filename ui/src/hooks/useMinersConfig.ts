// src/hooks/useMinersConfig.ts
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import {
  bitaxesResponseSchema,
  type MinerConfig,
} from "@/schemas/minerConfigSchema";
import { extractErrorMessage } from "@/utils/apiError";

interface MinersConfigResult {
  bitaxes: MinerConfig[];
  lastUpdated?: string;
}

const fetchMinersConfig = async (): Promise<MinersConfigResult> => {
  const { data } = await axios.get("/api/config/miners");
  return bitaxesResponseSchema.parse(data);
};

const postMinersConfig = async (
  miners: MinerConfig[],
): Promise<MinersConfigResult> => {
  const { data } = await axios.post("/api/config/miners", { bitaxes: miners });
  return bitaxesResponseSchema.parse(data);
};

export interface UseMinersConfigReturn {
  data: MinerConfig[] | undefined;
  /** miners.yml's own last-modified time (RFC3339), straight from the file's mtime -- undefined until the first fetch resolves. */
  lastUpdated: string | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /**
   * Adds/updates the given miners in the managed miners.yml (upserted by
   * MAC server-side). Resolves with the full, updated list on success and
   * refreshes `data` to match -- effective immediately on dashboard-api
   * (see Router.WithMinersStore), and picked up by the feeder (a separate
   * process) within one of its own polling cycles via mtime-based
   * hot-reload (see config.MinersStore, MINERS_DISCOVERY_PLAN.md Phase 4)
   * -- no restart needed either way.
   */
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  isSaving: boolean;
  saveError: string | null;
}

/**
 * The managed miners config (every entry in miners.yml, including disabled
 * ones) -- distinct from useMiners(), which is dashboard *data* (enabled,
 * reachable miners' live stats). Drives the "already configured" table on
 * the Settings page and the onboarding redirect when it's empty (see
 * RequireMinersConfigured).
 */
export const useMinersConfig = (): UseMinersConfigReturn => {
  const queryClient = useQueryClient();
  const query = useQuery<MinersConfigResult, Error>({
    queryKey: ["config", "miners"],
    queryFn: fetchMinersConfig,
    // Always refetched on mount rather than cached indefinitely (unlike
    // useMiners' staleTime: Infinity) -- this drives both the onboarding
    // redirect and the discovery page's "already configured" diff, both of
    // which need to see a save made just moments ago, not a stale snapshot.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveMiners = async (miners: MinerConfig[]): Promise<MinerConfig[]> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await postMinersConfig(miners);
      await query.refetch();
      // The dashboard (useMiners, GET /api/miners) has its own long-lived
      // cache (staleTime: Infinity, see useMiners.ts) -- without this it
      // would keep serving whatever it last saw (possibly "no miners" from
      // before this save) until a hard page reload, even though the
      // config-listing query above is already fresh.
      await queryClient.invalidateQueries({ queryKey: ["miners"] });
      return result.bitaxes;
    } catch (err: unknown) {
      setSaveError(extractErrorMessage(err));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    data: query.data?.bitaxes,
    lastUpdated: query.data?.lastUpdated,
    isLoading: query.isLoading,
    error: query.error ?? null,
    refetch: async () => {
      await query.refetch();
    },
    saveMiners,
    isSaving,
    saveError,
  };
};
