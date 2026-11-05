import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import { extractErrorMessage } from "@/utils/apiError";

export type RemoteAction = "restart" | "switch_primary" | "switch_fallback";

// The dashboard asks every minute: every 10 s is soon enough to tell.
const FOLLOW_EVERY_MS = 10_000;

/** Where a request stands comes with the miners (`miner.remoteAction`), so
 * they're read again while one is `inProgress`. */
export const useRemoteMinerAction = (inProgress: boolean) => {
  const { apiPaths } = useMode();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const minersPath = apiPaths.miners;

  useEffect(() => {
    if (!inProgress) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["miners", minersPath] });
    }, FOLLOW_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [inProgress, minersPath, queryClient]);

  const request = async (ip: string, action: RemoteAction) => {
    if (!apiPaths.remoteAction) return;
    setIsRequesting(true);
    setError(null);
    try {
      await axios.post(apiPaths.remoteAction(ip), { action });
      await queryClient.invalidateQueries({
        queryKey: ["miners", minersPath],
      });
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsRequesting(false);
    }
  };

  return { request, isRequesting, error, clearError: () => setError(null) };
};
