import { Area } from "recharts";

interface GapBridge {
  from: number;
  to: number;
  fromValue: number;
  toValue: number;
}

/** One bridge per break in a series (a stretch with nothing recorded): from
 * the last point before it to the first one after, so every chart draws the
 * same grey fill over it instead of leaving a hole that reads as a bug. A
 * break at either end of the series stays flat up to that end. */
export const gapBridges = (values: (number | null | undefined)[]) => {
  const bridges: GapBridge[] = [];
  values.forEach((v, i) => {
    if (v != null || (i > 0 && values[i - 1] == null)) return;
    let end = i;
    while (end + 1 < values.length && values[end + 1] == null) end++;
    const fromValue = values[i - 1] ?? values[end + 1];
    const toValue = values[end + 1] ?? values[i - 1];
    if (fromValue == null || toValue == null) return;
    bridges.push({
      from: Math.max(i - 1, 0),
      to: Math.min(end + 1, values.length - 1),
      fromValue,
      toValue,
    });
  });
  return bridges;
};

/** Adds one series per bridge to a recharts data array -- only its two
 * edges have a value, so the Area drawn by bridgeAreas is a straight band. */
export const withBridgeSeries = <T extends object>(
  data: T[],
  values: (number | null | undefined)[],
  prefix: string,
) => {
  const rows = data.map((d) => ({ ...d }) as T & Record<string, unknown>);
  const keys = gapBridges(values).map((bridge, n) => {
    const key = `${prefix}${n}`;
    (rows[bridge.from] as Record<string, unknown>)[key] = bridge.fromValue;
    (rows[bridge.to] as Record<string, unknown>)[key] = bridge.toValue;
    return key;
  });
  return { rows, keys };
};

// A plain function rather than a component: recharts only picks up series
// that are direct children of the chart.
export const bridgeAreas = (keys: string[], color: string) =>
  keys.map((key) => (
    <Area
      key={key}
      type="linear"
      dataKey={key}
      connectNulls
      stroke="none"
      fill={color}
      fillOpacity={0.12}
      dot={false}
      activeDot={false}
      tooltipType="none"
      isAnimationActive={false}
    />
  ));
