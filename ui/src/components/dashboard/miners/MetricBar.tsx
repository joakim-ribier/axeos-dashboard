import { Box, Typography } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import {
  fanThreshold,
  isFanHigh,
  isTempHigh,
  STATUS_COLOR,
  tempThreshold,
} from "@/utils/minerStatus";

/** The temp and fan gauges of a miner, the same wherever they're drawn --
 * the temperature's scale wide enough for a threshold above 80 °C. */
export const tempGauge = (miner: Miner) => ({
  threshold: tempThreshold(miner),
  alert: isTempHigh(miner),
  max: Math.max(80, tempThreshold(miner) + 10),
  unit: "°C",
});
export const fanGauge = (miner: Miner) => ({
  threshold: fanThreshold(miner),
  alert: isFanHigh(miner),
  max: 100,
  unit: "%",
});

interface ThresholdBarProps {
  /** The reading -- a filled bar, or a dot on the zones. */
  value?: number;
  /** The alert threshold, marked on the bar. */
  threshold: number;
  /** Its alert in progress -- which lasts until the reading is back a
   * margin under the threshold. */
  alert?: boolean;
  /** The level its alert ends under: the bar then shows the zones around
   * the threshold -- normal, back to normal, alert -- as Configuration
   * does where they're set. */
  clearBelow?: number;
  /** Full-scale value of the bar. */
  max: number;
}

/** A reading against its alert threshold, in the fleet's status colors:
 * green, then yellow within ~5% of it, red while its alert is on -- or,
 * given clearBelow, the zones around the threshold with the reading as a
 * dot on them. */
export const ThresholdBar = ({
  value,
  threshold,
  alert = false,
  clearBelow,
  max,
}: ThresholdBarProps) => {
  const at = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const color = alert
    ? "error.main"
    : value !== undefined && value >= threshold * 0.95
      ? STATUS_COLOR.warning
      : STATUS_COLOR.ok;
  const zone = (from: number, to: number, zoneColor: string) => (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: at(from),
        width: `calc(${at(to)} - ${at(from)})`,
        bgcolor: zoneColor,
      }}
    />
  );

  return (
    <Box
      data-testid="threshold-bar"
      sx={{
        position: "relative",
        height: 5,
        borderRadius: 3,
        bgcolor: "action.hover",
      }}
    >
      {clearBelow !== undefined ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          {zone(0, clearBelow, STATUS_COLOR.ok)}
          {zone(clearBelow, threshold, STATUS_COLOR.warning)}
          {zone(threshold, max, "error.main")}
        </Box>
      ) : (
        value !== undefined && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              width: at(value),
              borderRadius: 3,
              bgcolor: color,
            }}
          />
        )
      )}
      <Box
        sx={{
          position: "absolute",
          top: -3,
          bottom: -3,
          left: at(threshold),
          width: 2,
          borderRadius: 1,
          bgcolor: "text.secondary",
        }}
      />
      {clearBelow !== undefined && value !== undefined && (
        <Box
          sx={{
            position: "absolute",
            top: -4,
            left: `calc(${at(value)} - 6px)`,
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: 2,
            borderColor: "background.paper",
            bgcolor: "text.primary",
          }}
        />
      )}
    </Box>
  );
};

interface MetricBarProps extends ThresholdBarProps {
  value: number;
  unit: string;
}

export const MetricBar = ({
  value,
  unit,
  threshold,
  alert,
  max,
}: MetricBarProps) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
    <Typography
      variant="body2"
      sx={{
        fontVariantNumeric: "tabular-nums",
        color: alert ? "error.main" : "text.primary",
      }}
    >
      {`${value.toFixed(0)}${unit}`}
    </Typography>
    <ThresholdBar value={value} threshold={threshold} alert={alert} max={max} />
  </Box>
);
