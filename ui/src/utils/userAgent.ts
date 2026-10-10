// src/utils/userAgent.ts

// Order matters: Edge and Opera also claim Chrome, Chrome also claims
// Safari -- the first match wins.
const BROWSERS: [name: string, pattern: RegExp][] = [
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
  ["Safari", /Version\/(\d+).*Safari/],
  ["curl", /^curl\/(\d+)/],
];

// iPhone/iPad before Mac OS X: iOS user agents contain "like Mac OS X".
const SYSTEMS: [name: string, pattern: RegExp][] = [
  ["iOS", /iPhone|iPad/],
  ["Android", /Android/],
  ["Windows", /Windows/],
  ["macOS", /Mac OS X/],
  ["Linux", /Linux/],
];

/**
 * A short "Chrome 154 · macOS" summary of a User-Agent header, for display
 * only -- the audit log keeps the raw value. Falls back to the raw value
 * when nothing is recognized (a script, an unknown client).
 */
export function summarizeUserAgent(userAgent: string): string {
  let browser: string | undefined;
  for (const [name, pattern] of BROWSERS) {
    const match = userAgent.match(pattern);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const system = SYSTEMS.find(([, pattern]) => pattern.test(userAgent))?.[0];

  const parts = [browser, system].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : userAgent;
}
