import { useTranslation } from "react-i18next";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { Box, Typography } from "@mui/material";

import { type PowerDevice } from "@/schemas/appSettingsSchema";
import { type Miner } from "@/schemas/minerSchema";
import { formatMetric } from "@/utils/format";
import { displayName } from "@/utils/minerDisplay";

import { type SectionIcon, SectionLabel } from "../SectionLabel";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Lowest and highest reading of a single miner across the fleet, an arrow
 * saying which is which -- a single value when every miner reads the same. */
const MinMax = ({
  values,
  unit,
  decimals = 0,
}: {
  values: number[];
  unit: string;
  decimals?: number;
}) => {
  const min = Math.min(...values).toFixed(decimals);
  const max = Math.max(...values).toFixed(decimals);
  if (min === max) return `${min} ${unit}`;

  const arrowSx = { fontSize: "0.85em", color: "text.secondary" };
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
      <ArrowDownwardIcon sx={arrowSx} />
      {min}
      <ArrowUpwardIcon sx={{ ...arrowSx, ml: 1 }} />
      {`${max} ${unit}`}
    </Box>
  );
};

interface KpiProps {
  icon: SectionIcon;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}

/** Title, value, detail -- three lines, whatever the width. */
const Kpi = ({ icon, label, value, detail }: KpiProps) => (
  <Box
    role="group"
    aria-label={label}
    sx={{
      p: 2,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 0.75,
    }}
  >
    <SectionLabel icon={icon}>{label}</SectionLabel>
    <Typography
      noWrap
      sx={{ fontSize: "1.25rem", fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </Typography>
    {detail && (
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        component="div"
      >
        {detail}
      </Typography>
    )}
  </Box>
);

interface FleetKpisProps {
  miners: Miner[];
  devices: PowerDevice[];
}

export const FleetKpis = ({ miners, devices }: FleetKpisProps) => {
  const { t } = useTranslation();

  // An unreachable miner's latest.json still holds its last readings --
  // counting them would overstate what the fleet does right now.
  const online = miners.filter((m) => m.alive !== false);
  const hashRate = sum(online.map((m) => m.hashRateTHs));
  const power = sum(online.map((m) => m.power));
  // J/TH is reported as 0 for a miner with no hashrate -- it would pass for
  // the most efficient one.
  const hashing = online.filter((m) => m.hashRateTHs > 0);

  const rate =
    miners.find((m) => (m.electricityRatePerKwh ?? 0) > 0)
      ?.electricityRatePerKwh ?? 0;
  // The whole installation at today's draw: the miners' measured power plus
  // the other devices' declared one.
  const costPerDay =
    ((power + sum(devices.map((d) => d.power))) / 1000) * 24 * rate;
  const allTimeCost = sum(miners.map((m) => m.totalElectricityCost ?? 0));

  const best = miners.reduce<Miner | undefined>(
    (top, m) => (!top || m.bestDiff > top.bestDiff ? m : top),
    undefined,
  );
  const temps = online.map((m) => m.temp);
  const fans = online.map((m) => m.fanspeed);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        "& > *": { borderBottom: 1, borderColor: "divider" },
        "& > :nth-of-type(odd)": { borderRight: 1, borderColor: "divider" },
        "& > :nth-last-of-type(-n+2)": { borderBottom: 0 },
      }}
    >
      <Kpi
        icon="power"
        label={t("dashboard.kpi.power")}
        value={`${power.toFixed(0)} W`}
        detail={
          online.length ? (
            <MinMax values={online.map((m) => m.power)} unit="W" />
          ) : undefined
        }
      />
      <Kpi
        icon="efficiency"
        label={t("dashboard.kpi.efficiency")}
        value={hashRate > 0 ? `${(power / hashRate).toFixed(1)} J/TH` : "—"}
        detail={
          hashing.length ? (
            <MinMax
              values={hashing.map((m) => m.energyJPerTh)}
              unit="J/TH"
              decimals={1}
            />
          ) : undefined
        }
      />
      <Kpi
        icon="electricity"
        label={t("dashboard.kpi.electricity")}
        value={
          rate > 0
            ? t("dashboard.kpi.costPerDay", {
                value: `${costPerDay.toFixed(2)} €`,
              })
            : "—"
        }
        detail={
          allTimeCost > 0
            ? t("dashboard.kpi.allTime", {
                value: `${allTimeCost.toFixed(2)} €`,
              })
            : undefined
        }
      />
      <Kpi
        icon="shares"
        label={t("dashboard.kpi.shares")}
        value={sum(miners.map((m) => m.sharesAccepted)).toLocaleString()}
        detail={t("dashboard.kpi.allTime", {
          value: formatMetric(
            sum(miners.map((m) => m.totalSharesAccepted ?? m.sharesAccepted)),
          ),
        })}
      />
      <Kpi
        icon="bestDiff"
        label={t("dashboard.kpi.bestDiff")}
        value={best ? formatMetric(best.bestDiff) : "—"}
        detail={best && displayName(best)}
      />
      <Kpi
        icon="temperature"
        label={t("dashboard.kpi.temperature")}
        value={temps.length ? <MinMax values={temps} unit="°C" /> : "—"}
        detail={
          fans.length
            ? t("dashboard.kpi.maxFan", {
                value: Math.max(...fans).toFixed(0),
              })
            : undefined
        }
      />
    </Box>
  );
};
