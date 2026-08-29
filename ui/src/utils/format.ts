// src/utils/format.ts
/** Convert a monetary amount expressed in euros to a string of cents.
 *
 * @param euros      – amount in euros (e.g. 0.1234)
 * @param decimals   – number of decimal places to keep after the cent value
 *                     (default = 2 → "12.34 €")
 * @returns a string containing the amount in cents, rounded to the given
 *          number of decimals.
 *
 * Example:
 *   formatCents(0.1234)      → "12.34"
 *   formatCents(0.123456,4) → "12.3456"
 */
export function formatCents(euros: number, decimals: number = 2): string {
  const cents = euros * 100;
  return cents.toFixed(decimals);
}

/**
 * Formats a timestamp supplied as a string into a short, locale‑aware date‑time.
 *
 * @param ts – timestamp to format. Accepted forms:
 *           • ISO‑8601 (e.g. "2026-01-16T18:18:10Z")
 *           • Locale date string (e.g. "01/16/2026, 18:18")
 *           • Numeric string (seconds or milliseconds since epoch)
 * @returns formatted date‑time (e.g. "16/01/2026, 18:18") or "—" if the
 *          input is missing or cannot be parsed.
 */
export function formatTimestamp(ts?: string): string {
  if (!ts) return "—";

  const trimmed = ts.trim();

  const numeric = Number(trimmed);
  let ms: number;

  if (!Number.isNaN(numeric)) {
    ms = numeric > 1e12 ? numeric : numeric * 1000;
  } else {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return "—";
    ms = parsed.getTime();
  }

  const date = new Date(ms);
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

// ---------------------------------------------------------------------------
// Helper: format a large number with metric suffixes (K, M, G, T, P, …)
// Returns a string with two decimal places, e.g. "12.34 M"
// ---------------------------------------------------------------------------
export function formatMetric(num: number): string {
  const units = ["", "K", "M", "G", "T", "P", "E"];
  let magnitude = 0;
  let value = Math.abs(num);

  while (value >= 1000 && magnitude < units.length - 1) {
    value /= 1000;
    magnitude += 1;
  }

  const sign = num < 0 ? "-" : "";

  // Below 1000 there's no suffix to justify decimals -- "1.00" reads worse
  // than "1", so only numbers that actually got scaled down (K/M/G/...) keep
  // the two decimal places.
  if (magnitude === 0) {
    return `${sign}${Math.round(value)}`;
  }
  return `${sign}${value.toFixed(2)} ${units[magnitude]}`;
}

// ---------------------------------------------------------------------------
// Helper: format MM:SS for countdown timer
// ---------------------------------------------------------------------------
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Helper: format duration (days, hours, minutes) for stale indicators
// ---------------------------------------------------------------------------
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const mins = Math.floor((totalSeconds % (60 * 60)) / 60);
  const secs = totalSeconds % 60;

  if (days > 0) return `${days}j ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

// ---------------------------------------------------------------------------
// Helper: parse a Go time.Duration.String() value (e.g. "2m0s", "24h0m0s",
// "500ms") into milliseconds -- used to compare a configured poll interval
// against how long ago something last actually happened, client-side.
// ---------------------------------------------------------------------------
export function parseGoDuration(s?: string): number {
  if (!s) return 0;
  const unitMs: Record<string, number> = {
    h: 3_600_000,
    m: 60_000,
    s: 1_000,
    ms: 1,
  };
  let total = 0;
  for (const match of s.matchAll(/(\d+(?:\.\d+)?)(h|ms|m|s)/g)) {
    total += parseFloat(match[1]) * unitMs[match[2]];
  }
  return total;
}
