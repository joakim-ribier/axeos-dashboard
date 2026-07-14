import { describe, expect, it } from "vitest";

import {
  formatCents,
  formatDuration,
  formatMetric,
  formatTime,
  formatTimestamp,
} from "./format";

describe("formatCents", () => {
  it("converts euros to a cents string with 2 decimals by default", () => {
    expect(formatCents(0.1234)).toBe("12.34");
  });

  it("respects a custom decimals count", () => {
    expect(formatCents(0.123456, 4)).toBe("12.3456");
  });

  it("handles zero", () => {
    expect(formatCents(0)).toBe("0.00");
  });
});

describe("formatTimestamp", () => {
  it("returns — for an undefined timestamp", () => {
    expect(formatTimestamp(undefined)).toBe("—");
  });

  it("returns — for an empty timestamp", () => {
    expect(formatTimestamp("")).toBe("—");
  });

  it("returns — for an unparseable timestamp", () => {
    expect(formatTimestamp("not a date")).toBe("—");
  });

  it("formats a valid ISO-8601 timestamp to a non-fallback string", () => {
    const got = formatTimestamp("2026-01-16T18:18:10Z");
    expect(got).not.toBe("—");
  });
});

describe("formatMetric", () => {
  it("leaves small numbers without a unit suffix", () => {
    expect(formatMetric(42)).toBe("42.00 ");
  });

  it("converts thousands to K", () => {
    expect(formatMetric(1500)).toBe("1.50 K");
  });

  it("converts millions to M", () => {
    expect(formatMetric(1_234_567)).toBe("1.23 M");
  });

  it("keeps the sign for negative numbers", () => {
    expect(formatMetric(-2000)).toBe("-2.00 K");
  });

  it("handles zero", () => {
    expect(formatMetric(0)).toBe("0.00 ");
  });
});

describe("formatTime", () => {
  it("formats zero as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("pads seconds under 10", () => {
    expect(formatTime(65_000)).toBe("1:05");
  });

  it("does not roll minutes over into hours", () => {
    expect(formatTime(3_661_000)).toBe("61:01");
  });
});

describe("formatDuration", () => {
  it("formats minutes only when under an hour", () => {
    expect(formatDuration(45 * 60 * 1000)).toBe("45m");
  });

  it("formats hours and minutes when under a day", () => {
    expect(formatDuration((2 * 60 * 60 + 15 * 60) * 1000)).toBe("2h 15m");
  });

  it("formats days, hours and minutes when over a day", () => {
    expect(formatDuration((26 * 60 * 60 + 5 * 60) * 1000)).toBe("1j 2h 5m");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});
