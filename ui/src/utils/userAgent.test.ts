import { describe, expect, it } from "vitest";

import { summarizeUserAgent } from "./userAgent";

describe("summarizeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      "Chrome 154 · macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari 18 · iOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Edge 140 · Windows",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Firefox 140 · Linux",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Chrome 140 · Android",
    ],
    ["curl/8.7.1", "curl 8"],
  ])("summarizes %s", (userAgent, expected) => {
    expect(summarizeUserAgent(userAgent)).toBe(expected);
  });

  it("falls back to the raw value when nothing is recognized", () => {
    expect(summarizeUserAgent("python-requests/2.32")).toBe(
      "python-requests/2.32",
    );
  });
});
