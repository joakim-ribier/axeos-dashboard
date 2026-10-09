// src/utils/minerDisplay.ts

/** The label the UI should show for a miner: its operator-set alias if one
 * is configured, otherwise its hostname. Never read `.hostname` directly
 * for display -- an alias override (see minerConfigSchema.alias /
 * config.Bitaxe.Alias server-side) must win wherever a hostname would
 * otherwise be shown. */
export const displayName = (miner: {
  hostname?: string;
  alias?: string;
}): string | undefined => miner.alias || miner.hostname;

/** The pool a miner is actually mining on right now -- the fallback slot
 * when it's active, the primary one otherwise. */
export const activePoolUrl = (miner: {
  isUsingFallbackStratum?: number;
  stratumURL?: string;
  fallbackStratumURL?: string;
}): string =>
  (miner.isUsingFallbackStratum === 1
    ? miner.fallbackStratumURL
    : miner.stratumURL) ?? "";

/** "stratum+tcp://pool.example.com:3333" -> "pool.example.com". */
export const poolHostname = (url: string): string =>
  url.replace(/^[^:]+:\/\//, "").split(":")[0];
