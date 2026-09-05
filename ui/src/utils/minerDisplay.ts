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
