// src/utils/minerSearch.ts
import { Miner } from "@/schemas/minerSchema";

// The same fields actually surfaced to the user in MinerCard.tsx.
const SEARCHABLE_FIELDS: (keyof Miner)[] = [
  "hostname",
  "alias",
  "ip",
  "deviceModel",
  "stratumURL",
  "stratumUser",
  "fallbackStratumURL",
  "fallbackStratumUser",
  "version",
  "latestVersion",
];

interface NumericFieldConfig {
  field: keyof Miner;
  // temp/fan are displayed rounded to the nearest integer on MinerCard
  // (toFixed(0)) — round before comparing so a search matches what the
  // user actually sees. hashrate/power/uptime are shown with more
  // precision (or aren't rounded to a whole unit), so compare raw.
  round: boolean;
}

// Field aliases usable in a "field operator value" comparison, e.g. "temp>60".
const NUMERIC_FIELD_ALIASES: Record<string, NumericFieldConfig> = {
  temp: { field: "temp", round: true },
  fan: { field: "fanspeed", round: true },
  hashrate: { field: "hashRateTHs", round: false },
  power: { field: "power", round: false },
  uptime: { field: "uptimeSeconds", round: false },
};

// Tolerate a trailing "s" (temps/fans/uptimes...) so a common typo/plural
// doesn't silently fall back to a plain-text search that can never match.
const COMPARISON_PATTERN =
  /^(temp|fan|hashrate|power|uptime)s?\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/;

const compare = (value: number, operator: string, target: number): boolean => {
  switch (operator) {
    case ">":
      return value > target;
    case ">=":
      return value >= target;
    case "<":
      return value < target;
    case "<=":
      return value <= target;
    case "=":
      return value === target;
    default:
      return false;
  }
};

const matchesComparison = (miner: Miner, term: string): boolean | null => {
  const comparisonMatch = term.match(COMPARISON_PATTERN);
  if (!comparisonMatch) return null;

  const [, fieldAlias, operator, rawValue] = comparisonMatch;
  const { field, round } = NUMERIC_FIELD_ALIASES[fieldAlias];
  const value = miner[field];
  if (typeof value !== "number") return false;

  return compare(round ? Math.round(value) : value, operator, Number(rawValue));
};

const isOffline = (miner: Miner): boolean => miner.alive === false;

const matchesKeywordOrText = (miner: Miner, term: string): boolean => {
  if (term === "offline") return isOffline(miner);

  return SEARCHABLE_FIELDS.some((field) => {
    const value = miner[field];
    return typeof value === "string" && value.toLowerCase().includes(term);
  });
};

/**
 * Evaluates one search term, then applies a leading "!" or "-" negation
 * uniformly — it works the same way whether the term is a numeric
 * comparison ("!temp>60" == "temp<=60"), the "offline" keyword
 * ("!offline" == alive or unknown), or a plain substring ("!office"
 * excludes a hostname match).
 */
const matchesToken = (miner: Miner, rawTerm: string): boolean => {
  const negate = rawTerm.startsWith("!") || rawTerm.startsWith("-");
  const term = negate ? rawTerm.slice(1) : rawTerm;
  if (!term) return true; // a lone "!"/"-" is a no-op, not a crash

  const result =
    matchesComparison(miner, term) ?? matchesKeywordOrText(miner, term);
  return negate ? !result : result;
};

/**
 * Matches a miner against a free-text query, space-separated into terms
 * that must ALL match (AND). Each term can be:
 * - a numeric comparison, e.g. "temp>60", "fan<=50", "hashrate<0.3"
 * - the keyword "offline" (matches the alive field being explicitly false)
 * - a plain substring, matched against hostname/ip/model/pool/version
 * - any of the above negated with a leading "!" or "-", e.g. "!temp>60",
 *   "!offline", "-office"
 *
 * An empty/whitespace-only query always matches (no-op filter).
 */
export const matchesSearch = (miner: Miner, query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  // Collapse whitespace around comparison operators first ("temp > 60" ->
  // "temp>60") so it survives being split into space-separated terms below.
  const normalized = trimmed.replace(/\s*(>=|<=|>|<|=)\s*/g, "$1");

  return normalized.split(/\s+/).every((token) => matchesToken(miner, token));
};
