import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { bridgeAreas, withBridgeSeries } from "../gapBridges";

// Takes whatever height is left next to the KPI grid.
const fillSx = { flex: 1, minHeight: 130 };

/** A bucket with no neighbour on either side has no line to sit on --
 * without a dot it would simply not show. */
const isIsolated = (points: FleetPoint[], i: number) =>
  points[i]?.hashRate != null &&
  points[i - 1]?.hashRate == null &&
  points[i + 1]?.hashRate == null;

export interface FleetPoint {
  time: string;
  hashRate: number | null;
}

interface FleetChartProps {
  points: FleetPoint[];
}

export const FleetChart = ({ points }: FleetChartProps) => {
  const { t } = useTranslation();
  const { palette } = useTheme();
  // A stretch where no miner reported at all: the feeder wasn't running.
  const { rows, keys: gapKeys } = withBridgeSeries(
    points,
    points.map((p) => p.hashRate),
    "gap",
  );
  const axisTick = { fontSize: 10, fill: palette.text.secondary };

  if (points.every((p) => p.hashRate === null)) {
    return (
      <Box sx={{ ...fillSx, display: "grid", placeItems: "center" }}>
        <Typography variant="body2" color="text.disabled">
          {t("graph.noDataAvailable")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={fillSx}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fleet-hashrate" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={palette.primary.main}
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor={palette.primary.main}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke={palette.divider}
            vertical={false}
          />
          {/* One label every 6h, each in the middle of its stretch: the
              curve runs edge to edge, a label on the edge would be cut. */}
          <XAxis
            dataKey="time"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            ticks={points.filter((_, i) => i % 24 === 12).map((p) => p.time)}
          />
          {/* Ticks drawn inside the plot rather than in a column of their
              own, so the curve runs from edge to edge of the card. */}
          <YAxis
            mirror
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickCount={3}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.background.default,
              border: `1px solid ${palette.divider}`,
              borderRadius: 4,
              fontSize: 12,
            }}
            formatter={(value) => [
              `${Number(value).toFixed(2)} TH/s`,
              t("dashboard.fleet.hashrate"),
            ]}
          />
          {bridgeAreas(gapKeys, palette.text.secondary)}
          <Area
            type="monotone"
            dataKey="hashRate"
            stroke={palette.primary.main}
            strokeWidth={2}
            fill="url(#fleet-hashrate)"
            dot={({ cx, cy, index }) => (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={isIsolated(points, index) ? 2.5 : 0}
                fill={palette.primary.main}
              />
            )}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};
