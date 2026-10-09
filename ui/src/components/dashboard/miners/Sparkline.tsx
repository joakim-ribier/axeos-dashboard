import { Box } from "@mui/material";

import { gapBridges } from "../gapBridges";

const WIDTH = 100;

type Point = [number, number];

/** Consecutive non-null points, split wherever there's a null -- so the
 * line breaks at a gap and picks up again from the first sample after it. */
const toRuns = (points: (Point | null)[]): Point[][] =>
  points
    .reduce<Point[][]>(
      (runs, p) => {
        if (p) runs[runs.length - 1].push(p);
        else runs.push([]);
        return runs;
      },
      [[]],
    )
    .filter((run) => run.length > 0);

// Starting on the first point twice gives a lone point a zero-length line,
// which the round cap draws as a dot.
const linePath = (run: Point[]) =>
  `M${[run[0], ...run].map(([x, y]) => `${x},${y}`).join(" L")}`;

interface SparklineProps {
  /** 0 = miner unreachable, drawn in red on the baseline. null = no sample
   * at all (feeder not running): a grey bridge, since what the miner did
   * then is unknown. */
  values: (number | null)[];
  /** Any MUI sx color, e.g. "primary.main". */
  color: string;
  height?: number;
}

/** Scaled from zero rather than from its own minimum, so a dip reads as a
 * real drop instead of every small wobble looking like an outage. */
export const Sparkline = ({ values, color, height = 24 }: SparklineProps) => {
  const max = Math.max(0, ...values.filter((v) => v !== null));
  const x = (i: number) => (i / Math.max(values.length - 1, 1)) * WIDTH;
  const y = (v: number) => height - 1 - (max ? (v / max) * (height - 2) : 0);

  const points = values.map<Point | null>((v, i) =>
    v === null ? null : [x(i), y(v)],
  );
  const runs = toRuns(points);
  const offlineRuns = toRuns(
    points.map((p, i) => (values[i] === 0 ? p : null)),
  );

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      sx={{ display: "block", width: "100%", height, color }}
    >
      {gapBridges(values).map(({ from, to, fromValue, toValue }) => (
        <Box
          component="path"
          key={`gap-${from}`}
          d={`M${x(from)},${y(fromValue)} L${x(to)},${y(toValue)} L${x(to)},${height} L${x(from)},${height} Z`}
          fill="currentColor"
          opacity={0.15}
          sx={{ color: "text.secondary" }}
        />
      ))}
      {runs.map((run) => (
        <g key={run[0][0]}>
          <path
            d={`${linePath(run)} L${run[run.length - 1][0]},${height} L${run[0][0]},${height} Z`}
            fill="currentColor"
            opacity={0.15}
          />
          <path
            d={linePath(run)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {offlineRuns.map((run) => (
        <Box
          component="path"
          key={`offline-${run[0][0]}`}
          d={linePath(run)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          sx={{ color: "error.main" }}
        />
      ))}
    </Box>
  );
};
