import { useTranslation } from "react-i18next";
import { Box, Paper, Typography } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import {
  FAN_THRESHOLD,
  isFanHigh,
  isTempHigh,
  TEMP_THRESHOLD,
} from "@/utils/minerStatus";

import { FAN_GAUGE, TEMP_GAUGE, ThresholdBar } from "../miners/MetricBar";
import { Sparkline } from "../miners/Sparkline";
import { type SectionIcon, SectionLabel } from "../SectionLabel";

interface VitalProps {
  icon: SectionIcon;
  label: string;
  value: string;
  unit: string;
  alert?: boolean;
  children?: React.ReactNode;
}

const Vital = ({ icon, label, value, unit, alert, children }: VitalProps) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.75,
      display: "flex",
      flexDirection: "column",
      gap: 1,
      minWidth: 0,
    }}
  >
    <SectionLabel icon={icon}>{label}</SectionLabel>
    <Typography
      sx={{
        fontSize: "1.75rem",
        fontWeight: 600,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        color: alert ? "error.main" : "text.primary",
      }}
    >
      {value}
      <Typography
        component="span"
        sx={{ ml: 0.5, fontSize: "0.875rem", color: "text.secondary" }}
      >
        {unit}
      </Typography>
    </Typography>
    <Box sx={{ mt: "auto" }}>{children}</Box>
  </Paper>
);

interface MinerVitalsProps {
  miner: Miner;
  hashRateHistory?: (number | null)[];
}

/** The four readings that say whether a miner is doing well, each with what
 * puts it in context: its last 24h, or how far it is from its threshold. */
export const MinerVitals = ({ miner, hashRateHistory }: MinerVitalsProps) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 1.5,
        opacity: miner.alive === false ? 0.5 : 1,
      }}
    >
      <Vital
        icon="hashrate"
        label={t("dashboard.fleet.hashrate")}
        value={miner.hashRateTHs.toFixed(2)}
        unit="TH/s"
      >
        {hashRateHistory && (
          <Sparkline
            values={hashRateHistory}
            color="primary.main"
            height={32}
          />
        )}
      </Vital>
      <Vital
        icon="power"
        label={t("dashboard.kpi.power")}
        value={miner.power.toFixed(1)}
        unit="W"
      >
        <Typography variant="body2" color="text.secondary">
          {`${miner.energyJPerTh.toFixed(1)} J/TH`}
        </Typography>
      </Vital>
      <Vital
        icon="temperature"
        label={t("dashboard.columns.temp")}
        value={miner.temp.toFixed(1)}
        unit="°C"
        alert={isTempHigh(miner)}
      >
        <ThresholdBar value={miner.temp} {...TEMP_GAUGE} />
        <Typography variant="caption" color="text.secondary">
          {t("dashboard.drawer.threshold", { value: `${TEMP_THRESHOLD} °C` })}
        </Typography>
      </Vital>
      <Vital
        icon="fan"
        label={t("dashboard.columns.fan")}
        value={miner.fanspeed.toFixed(0)}
        unit="%"
        alert={isFanHigh(miner)}
      >
        <ThresholdBar value={miner.fanspeed} {...FAN_GAUGE} />
        <Typography variant="caption" color="text.secondary">
          {t("dashboard.drawer.threshold", { value: `${FAN_THRESHOLD} %` })}
        </Typography>
      </Vital>
    </Box>
  );
};
