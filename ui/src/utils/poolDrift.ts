// src/utils/poolDrift.ts
import type { MinerConfig } from "@/schemas/minerConfigSchema";
import type { Miner } from "@/schemas/minerSchema";

export type PoolField =
  "url" | "port" | "user" | "fallbackUrl" | "fallbackPort" | "fallbackUser";

export interface PoolMismatch {
  field: PoolField;
  configured: string;
  live: string;
}

/**
 * Compares the miner's saved pool config (miners.yml -- what the scheduler
 * and the manual pool-switch actions actually send, see PoolEditor) against
 * what the device itself is currently reporting on its live poll (see
 * Miner.stratumURL/stratumPort/... server-side in handler.toMinerInfo).
 * They can drift silently -- a pool changed by hand on the device's own web
 * UI, a switch action that ran before a config edit was saved, a device
 * re-flashed with different defaults -- and that drift is easy to miss
 * until a scheduled switch does something the operator didn't expect.
 *
 * Returns the empty array when everything matches, or when there's no live
 * data to compare against yet (a device that's never been successfully
 * polled reports port 0 for both slots, which is never treated as a real
 * mismatch).
 */
export const poolMismatches = (
  configured: MinerConfig,
  live: Miner | undefined,
): PoolMismatch[] => {
  if (!live) return [];

  const mismatches: PoolMismatch[] = [];
  const checkString = (
    field: PoolField,
    configuredValue: string,
    liveValue: string | undefined,
  ) => {
    if (!liveValue) return;
    if (configuredValue !== liveValue) {
      mismatches.push({ field, configured: configuredValue, live: liveValue });
    }
  };
  const checkPort = (
    field: PoolField,
    configuredValue: number,
    liveValue: number | undefined,
  ) => {
    if (!liveValue) return;
    if (configuredValue !== liveValue) {
      mismatches.push({
        field,
        configured: String(configuredValue),
        live: String(liveValue),
      });
    }
  };

  checkString("url", configured.url, live.stratumURL);
  checkPort("port", configured.port, live.stratumPort);
  checkString("user", configured.user, live.stratumUser);
  checkString("fallbackUrl", configured.fallbackUrl, live.fallbackStratumURL);
  checkPort("fallbackPort", configured.fallbackPort, live.fallbackStratumPort);
  checkString(
    "fallbackUser",
    configured.fallbackUser,
    live.fallbackStratumUser,
  );

  return mismatches;
};

/** Human label for one PoolField (e.g. "Primary URL"), built from the same
 * translation keys PoolEditor's own form fields use -- shared so the
 * compact per-row warning badge (ConfiguredMinersTable) and the full
 * drift banner (PoolEditor) describe a mismatch identically. Takes `t`
 * as a parameter rather than calling useTranslation() itself since this
 * is a plain util, not a component/hook. */
export const poolFieldLabel = (
  t: (key: string) => string,
  field: PoolField,
): string => {
  const section = field.startsWith("fallback")
    ? t("settingsPage.configured.pool.fallback")
    : t("settingsPage.configured.pool.primary");
  const sub =
    field === "url" || field === "fallbackUrl"
      ? t("settingsPage.configured.pool.urlLabel")
      : field === "port" || field === "fallbackPort"
        ? t("settingsPage.configured.pool.portLabel")
        : t("settingsPage.configured.pool.userLabel");
  return `${section} ${sub}`;
};
