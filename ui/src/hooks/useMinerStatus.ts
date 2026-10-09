import { useEffect, useState } from "react";

import { useAppSettings } from "@/hooks/useAppSettings";
import { type Miner } from "@/schemas/minerSchema";
import { parseGoDuration } from "@/utils/format";
import { getMinerStatus } from "@/utils/minerStatus";

// A remote board never gets the source feeder's interval (see
// RemoteAppSettings) -- 5 minutes covers the default 2m interval plus one
// full poll cycle.
const FALLBACK_FEEDER_INTERVAL_MS = 5 * 60_000;

/** The one rule for "readings stopped coming in": the last one is more than
 * two feeder poll cycles old. Re-evaluated every 30s, so a miner falls
 * behind on screen even with auto-refresh off. */
export const useMinerStatus = () => {
  const { data: appSettings } = useAppSettings();
  const intervalMs =
    parseGoDuration(appSettings?.readOnly.feederInterval) ||
    FALLBACK_FEEDER_INTERVAL_MS;

  // Captured in an effect rather than read during render (Date.now() is
  // impure).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const isStale = (timestamp: string) =>
    now !== null &&
    timestamp !== "" &&
    now - new Date(timestamp).getTime() > 2 * intervalMs;

  return {
    isStale,
    statusOf: (miner: Miner) => getMinerStatus(miner, isStale(miner.timestamp)),
  };
};
