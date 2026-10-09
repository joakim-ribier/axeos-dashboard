import { Box, Typography } from "@mui/material";

import { FAN_THRESHOLD, TEMP_THRESHOLD } from "@/utils/minerStatus";

/** The temp and fan gauges, the same wherever they're drawn. */
export const TEMP_GAUGE = { threshold: TEMP_THRESHOLD, max: 80, unit: "°C" };
export const FAN_GAUGE = { threshold: FAN_THRESHOLD, max: 100, unit: "%" };

interface ThresholdBarProps {
  value: number;
  /** The alert threshold, marked on the bar. */
  threshold: number;
  /** Full-scale value of the bar. */
  max: number;
}

/** How close a reading is to its alert threshold: green, then orange
 * within ~5% of it, red past it. */
export const ThresholdBar = ({ value, threshold, max }: ThresholdBarProps) => {
  const color =
    value >= threshold
      ? "error.main"
      : value >= threshold * 0.95
        ? "warning.main"
        : "success.main";

  return (
    <Box
      sx={{
        position: "relative",
        height: 5,
        borderRadius: 3,
        bgcolor: "action.hover",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          width: `${Math.min(100, (value / max) * 100)}%`,
          borderRadius: 3,
          bgcolor: color,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: -3,
          bottom: -3,
          left: `${(threshold / max) * 100}%`,
          width: 2,
          borderRadius: 1,
          bgcolor: "text.secondary",
        }}
      />
    </Box>
  );
};

interface MetricBarProps extends ThresholdBarProps {
  unit: string;
}

export const MetricBar = ({ value, unit, threshold, max }: MetricBarProps) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
    <Typography
      variant="body2"
      sx={{
        fontVariantNumeric: "tabular-nums",
        color: value >= threshold ? "error.main" : "text.primary",
      }}
    >
      {`${value.toFixed(0)}${unit}`}
    </Typography>
    <ThresholdBar value={value} threshold={threshold} max={max} />
  </Box>
);
