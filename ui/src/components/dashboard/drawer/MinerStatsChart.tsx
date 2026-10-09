// src/components/dashboard/drawer/MinerStatsChart.tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Typography } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MinerInfo } from "@/types/miner";

import { bridgeAreas, withBridgeSeries } from "../gapBridges";

interface ChartField {
  key: keyof MinerInfo;
  label: string;
  unit: string;
  color: string;
  exclusive?: boolean;
}

interface Props {
  data: MinerInfo[];
  isLoading?: boolean;
  selectedFields: (keyof MinerInfo)[];
  onFieldToggle: (field: keyof MinerInfo) => void;
  maxHeight?: number;
}

const AVAILABLE_FIELDS: ChartField[] = [
  { key: "temp", label: "Temp", unit: "°C", color: "#ff6b6b" },
  { key: "fanspeed", label: "Fan", unit: "%", color: "#b0bec5" },
  {
    key: "hashRateTHs",
    label: "Hash",
    unit: "TH/s",
    color: "#00b4ff",
    exclusive: true,
  },
  {
    key: "responseTime",
    label: "Ping",
    unit: "ms",
    color: "#ffa726",
    exclusive: true,
  },
];

type TimeRange = "1h" | "day";

type ChartPoint = {
  formattedTime: string;
  originalTimestamp: string;
} & Partial<
  Pick<MinerInfo, "temp" | "fanspeed" | "hashRateTHs" | "responseTime">
>;

export const MinerStatsChart = ({
  data,
  isLoading,
  selectedFields,
  onFieldToggle,
  maxHeight = 200,
}: Props) => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");

  const chartData = useMemo((): ChartPoint[] => {
    if (timeRange === "1h") {
      if (data.length === 0) return [];
      const lastTs = new Date(data[data.length - 1].timestamp).getTime();
      const oneHourAgo = new Date(lastTs - 60 * 60 * 1000);
      return data
        .filter((entry) => new Date(entry.timestamp) >= oneHourAgo)
        .map((entry) => {
          const date = new Date(entry.timestamp);
          const h = String(date.getHours()).padStart(2, "0");
          const m = String(date.getMinutes()).padStart(2, "0");
          return {
            formattedTime: `${h}:${m}`,
            originalTimestamp: entry.timestamp,
            temp: entry.temp,
            fanspeed: entry.fanspeed,
            hashRateTHs: entry.hashRateTHs,
            responseTime: entry.responseTime,
          };
        });
    }

    // "day" mode: hourly averages over the last 24h. Keyed by the hour's
    // actual start rather than its "HH:00" label, since the window spans two
    // calendar days -- the same hour of yesterday and today must not merge.
    type Bucket = {
      sums: Partial<
        Pick<MinerInfo, "temp" | "fanspeed" | "hashRateTHs" | "responseTime">
      >;
      count: number;
    };
    const buckets = new Map<number, Bucket>();
    data.forEach((entry) => {
      const hourStart = new Date(entry.timestamp).setMinutes(0, 0, 0);
      if (!buckets.has(hourStart))
        buckets.set(hourStart, { sums: {}, count: 0 });
      const b = buckets.get(hourStart)!;
      b.count++;
      AVAILABLE_FIELDS.forEach((f) => {
        const val = entry[f.key];
        if (typeof val === "number") {
          const k = f.key as keyof typeof b.sums;
          b.sums[k] = ((b.sums[k] ?? 0) as number) + val;
        }
      });
    });

    // Every hour gets a point, empty when nothing was recorded, so the axis
    // stays proportional to time and a break (feeder stopped) shows as one
    // instead of its two sides being drawn next to each other.
    const hours = [...buckets.keys()];
    const points: ChartPoint[] = [];
    for (
      let hourStart = Math.min(...hours);
      hourStart <= Math.max(...hours);
      hourStart += 3_600_000
    ) {
      const b = buckets.get(hourStart);
      const avg = (key: keyof Bucket["sums"]) =>
        b && b.sums[key] !== undefined ? b.sums[key] / b.count : undefined;
      points.push({
        formattedTime: `${String(new Date(hourStart).getHours()).padStart(2, "0")}:00`,
        originalTimestamp: new Date(hourStart).toISOString(),
        temp: avg("temp"),
        fanspeed: avg("fanspeed"),
        hashRateTHs: avg("hashRateTHs"),
        responseTime: avg("responseTime"),
      });
    }
    return points;
  }, [data, timeRange]);

  const referenceX = useMemo(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${h}:${m}`;
    if (!chartData.length) return currentTimeStr;
    const exact = chartData.find((d) => d.formattedTime === currentTimeStr);
    if (exact) return currentTimeStr;
    let closest = chartData[0].formattedTime;
    let closestDiff = Infinity;
    chartData.forEach((d) => {
      const diff = Math.abs(
        now.getTime() - new Date(d.originalTimestamp).getTime(),
      );
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = d.formattedTime;
      }
    });
    return closest;
  }, [chartData]);

  if (isLoading) {
    return (
      <Box
        sx={{
          height: maxHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {t("graph.loading")}
        </Typography>
      </Box>
    );
  }

  if (!chartData.length) {
    return (
      <Box
        sx={{
          height: maxHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="body2" color="text.disabled">
          {t("graph.noDataAvailable")}
        </Typography>
      </Box>
    );
  }

  // An hour with nothing recorded (feeder not running) gets the same grey
  // bridge as the fleet chart and the sparklines, for each plotted field.
  let rows: (ChartPoint & Record<string, unknown>)[] = chartData;
  const gapKeys: string[] = [];
  selectedFields.forEach((fieldKey) => {
    const added = withBridgeSeries(
      rows,
      rows.map((p) => p[fieldKey as keyof ChartPoint] as number | undefined),
      `gap-${String(fieldKey)}-`,
    );
    rows = added.rows;
    gapKeys.push(...added.keys);
  });

  return (
    <Box sx={{ width: "100%" }}>
      {/* Controls: field toggles (left, wrappable) + time range (right, fixed) */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1,
          mb: 1.5,
        }}
      >
        {/* Field chips — wrap freely */}
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ flex: 1 }}
        >
          {AVAILABLE_FIELDS.map((field) => {
            const isSelected = selectedFields.includes(field.key);
            return (
              <Box
                key={String(field.key)}
                onClick={() => onFieldToggle(field.key)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1.5,
                  py: 0.6,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: isSelected ? field.color : "divider",
                  backgroundColor: isSelected
                    ? `${field.color}18`
                    : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  userSelect: "none",
                  "&:hover": {
                    borderColor: field.color,
                    backgroundColor: `${field.color}0d`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: isSelected
                      ? field.color
                      : "rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.75rem",
                    color: isSelected ? field.color : "text.disabled",
                    lineHeight: 1,
                  }}
                >
                  {field.label} · {field.unit}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        {/* Time range toggle — always right-aligned, never wraps */}
        <Stack direction="row" spacing={0.5} flexShrink={0}>
          {(["1h", "day"] as TimeRange[]).map((range) => (
            <Box
              key={range}
              onClick={() => setTimeRange(range)}
              sx={{
                px: 1,
                py: 0.4,
                borderRadius: 1,
                border: "1px solid",
                borderColor: timeRange === range ? "primary.main" : "divider",
                backgroundColor:
                  timeRange === range ? "rgba(0,180,255,0.1)" : "transparent",
                color: timeRange === range ? "primary.main" : "text.disabled",
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  color: "primary.main",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: "0.7rem", lineHeight: 1 }}
              >
                {range === "1h" ? "1H" : t("graph.day")}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Chart */}
      <Box sx={{ height: maxHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              {AVAILABLE_FIELDS.map((field) => (
                <linearGradient
                  key={String(field.key)}
                  id={`grad-${String(field.key)}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={field.color}
                    stopOpacity={0.35}
                  />
                  <stop offset="95%" stopColor={field.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="formattedTime"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              angle={-45}
              textAnchor="end"
              height={40}
            />
            {/* Ticks drawn inside the plot rather than in a column of their
                own, so the curve runs from edge to edge of the card. */}
            <YAxis
              mirror
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.5)" }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e1e2a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                fontSize: 11,
                color: "#fff",
                padding: "6px 10px",
              }}
              labelStyle={{
                color: "rgba(255,255,255,0.45)",
                marginBottom: 4,
                fontSize: 10,
              }}
              formatter={(value, name) => {
                const key = String(name) as keyof typeof AVAILABLE_FIELDS;
                const field = AVAILABLE_FIELDS.find(
                  (f) => String(f.key) === String(name),
                );
                const val =
                  typeof value === "number" ? value.toFixed(2) : String(value);
                void key;
                return [
                  `${val} ${field?.unit ?? ""}`,
                  field?.label ?? String(name),
                ] as [string, string];
              }}
            />
            {bridgeAreas(gapKeys, "rgba(255,255,255,0.6)")}
            <ReferenceLine
              x={referenceX}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
              label={{
                value: "now",
                position: "top",
                fill: "rgba(255,255,255,0.35)",
                fontSize: 9,
              }}
            />
            {selectedFields.map((fieldKey) => {
              const field = AVAILABLE_FIELDS.find((f) => f.key === fieldKey);
              if (!field) return null;
              const pointKey = fieldKey as keyof ChartPoint;
              return (
                <Area
                  key={String(fieldKey)}
                  type="monotone"
                  dataKey={String(fieldKey)}
                  stroke={field.color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${String(fieldKey)})`}
                  // A point with no neighbour on either side (the only hour
                  // with samples, or one between two breaks) has no line to
                  // sit on -- show it as a dot.
                  dot={({ cx, cy, index }) => (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={
                        chartData[index]?.[pointKey] != null &&
                        chartData[index - 1]?.[pointKey] == null &&
                        chartData[index + 1]?.[pointKey] == null
                          ? 3
                          : 0
                      }
                      fill={field.color}
                    />
                  )}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};
