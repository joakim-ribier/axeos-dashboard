import { describe, expect, it } from "vitest";

import { boardIdFromPathname } from "./boardId";

describe("boardIdFromPathname", () => {
  it("returns undefined for the local root", () => {
    expect(boardIdFromPathname("/")).toBeUndefined();
  });

  it("returns the board id for a single-segment remote route", () => {
    expect(boardIdFromPathname("/demo")).toBe("demo");
  });

  it("returns only the first segment for a nested remote route", () => {
    expect(boardIdFromPathname("/demo/alerts")).toBe("demo");
  });

  it("returns undefined for the local alerts route", () => {
    expect(boardIdFromPathname("/alerts")).toBeUndefined();
  });
});
