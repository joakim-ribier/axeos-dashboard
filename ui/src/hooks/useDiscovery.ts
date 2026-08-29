// src/hooks/useDiscovery.ts
import { useState } from "react";
import axios from "axios";

import {
  bitaxesResponseSchema,
  type MinerConfig,
} from "@/schemas/minerConfigSchema";
import { extractErrorMessage } from "@/utils/apiError";

// A longer per-host probe timeout to retry with when a first (fast,
// default ~1s) pass found nothing -- see discovery.MaxProbeTimeout
// server-side, which this must stay under.
const RETRY_TIMEOUT = "3s";

type SearchParams = Record<string, string>;

const fetchDiscovered = async (
  params: SearchParams,
): Promise<MinerConfig[]> => {
  const { data } = await axios.get("/api/config/discover", { params });
  return bitaxesResponseSchema.parse(data).bitaxes;
};

export interface UseDiscoveryReturn {
  results: MinerConfig[];
  isSearching: boolean;
  error: string | null;
  hasSearched: boolean;
  /** Scan the given CIDR, or the server's own local subnet if omitted. */
  scanNetwork: (cidr?: string) => Promise<void>;
  /** Probe exactly this one IP. */
  probeIp: (ip: string) => Promise<void>;
  /** Re-runs the last search (scan or probe) with a longer per-host timeout. */
  retryWithLongerTimeout: () => Promise<void>;
  reset: () => void;
}

export const useDiscovery = (): UseDiscoveryReturn => {
  const [results, setResults] = useState<MinerConfig[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastParams, setLastParams] = useState<SearchParams | null>(null);

  const run = async (params: SearchParams) => {
    setIsSearching(true);
    setError(null);
    setLastParams(params);
    try {
      setResults(await fetchDiscovered(params));
    } catch (err: unknown) {
      setResults([]);
      setError(extractErrorMessage(err));
    } finally {
      setHasSearched(true);
      setIsSearching(false);
    }
  };

  return {
    results,
    isSearching,
    error,
    hasSearched,
    scanNetwork: (cidr) => run(cidr ? { cidr } : {}),
    probeIp: (ip) => run({ ip }),
    retryWithLongerTimeout: () =>
      run({ ...(lastParams ?? {}), timeout: RETRY_TIMEOUT }),
    reset: () => {
      setResults([]);
      setError(null);
      setHasSearched(false);
      setLastParams(null);
    },
  };
};
