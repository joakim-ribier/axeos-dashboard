import { describe, expect, it } from "vitest";

import { describeCron, nextCronRuns, normalizeCronExpression } from "./cron";

describe("describeCron", () => {
  it("translates a valid 6-field cron expression to a sentence", () => {
    const result = describeCron("59 59 23 * * FRI", "en");
    expect(result).not.toBeNull();
    expect(result).toMatch(/Friday/i);
  });

  it("returns null for an invalid expression", () => {
    expect(describeCron("not a cron expression", "en")).toBeNull();
  });

  it("returns null for an empty expression", () => {
    expect(describeCron("", "en")).toBeNull();
    expect(describeCron("   ", "en")).toBeNull();
  });

  it("falls back to English for a locale cronstrue doesn't ship", () => {
    // Only exercises that it doesn't throw / return null for a supported
    // fallback -- locale is passed straight through as "en" whenever it
    // doesn't start with "fr".
    expect(describeCron("59 59 23 * * FRI", "de")).not.toBeNull();
  });
});

describe("nextCronRuns", () => {
  it("returns the requested number of upcoming dates for a valid expression", () => {
    const runs = nextCronRuns("0 0 0 * * *", 3);
    expect(runs).not.toBeNull();
    expect(runs).toHaveLength(3);
    runs?.forEach((d) => expect(d).toBeInstanceOf(Date));
  });

  it("returns dates in chronological order", () => {
    const runs = nextCronRuns("0 0 0 * * *", 3);
    expect(runs).not.toBeNull();
    const [a, b, c] = runs!;
    expect(a.getTime()).toBeLessThan(b.getTime());
    expect(b.getTime()).toBeLessThan(c.getTime());
  });

  it("returns null for an invalid expression", () => {
    expect(nextCronRuns("not a cron expression")).toBeNull();
  });

  it("returns null for an empty expression", () => {
    expect(nextCronRuns("")).toBeNull();
  });
});

describe("normalizeCronExpression", () => {
  it("collapses repeated whitespace", () => {
    expect(normalizeCronExpression("59  59   23 * * FRI")).toBe(
      normalizeCronExpression("59 59 23 * * FRI"),
    );
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeCronExpression("  59 59 23 * * FRI  ")).toBe(
      normalizeCronExpression("59 59 23 * * FRI"),
    );
  });

  it("lowercases day/month names", () => {
    expect(normalizeCronExpression("59 59 23 * * FRI")).toBe(
      normalizeCronExpression("59 59 23 * * fri"),
    );
  });

  it("does not consider genuinely different expressions equal", () => {
    expect(normalizeCronExpression("59 59 23 * * FRI")).not.toBe(
      normalizeCronExpression("59 59 23 * * SUN"),
    );
  });
});
