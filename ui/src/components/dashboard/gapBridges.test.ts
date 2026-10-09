import { describe, expect, it } from "vitest";

import { gapBridges, withBridgeSeries } from "./gapBridges";

describe("gapBridges", () => {
  it("is empty when nothing is missing", () => {
    expect(gapBridges([1, 2, 3])).toEqual([]);
  });

  it("bridges a break from the point before it to the point after", () => {
    expect(gapBridges([1, null, null, 4])).toEqual([
      { from: 0, to: 3, fromValue: 1, toValue: 4 },
    ]);
  });

  it("keeps a break at either end flat up to that end", () => {
    expect(gapBridges([null, 2, 3, null])).toEqual([
      { from: 0, to: 1, fromValue: 2, toValue: 2 },
      { from: 2, to: 3, fromValue: 3, toValue: 3 },
    ]);
  });

  it("treats a zero as a value, not a break", () => {
    expect(gapBridges([1, 0, 1])).toEqual([]);
  });

  it("has nothing to bridge when there is no value at all", () => {
    expect(gapBridges([null, null])).toEqual([]);
  });
});

describe("withBridgeSeries", () => {
  it("adds one series per bridge, set only on its two edges", () => {
    const data = [{ v: 1 }, { v: null }, { v: 3 }];
    const { rows, keys } = withBridgeSeries(
      data,
      data.map((d) => d.v),
      "gap",
    );

    expect(keys).toEqual(["gap0"]);
    expect(rows).toEqual([{ v: 1, gap0: 1 }, { v: null }, { v: 3, gap0: 3 }]);
    expect(data[0]).toEqual({ v: 1 });
  });
});
