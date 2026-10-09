import { useTranslation } from "react-i18next";
import SyncIcon from "@mui/icons-material/Sync";
import { Box, Paper, Tooltip, Typography } from "@mui/material";

import { type PowerDevice } from "@/schemas/appSettingsSchema";
import { type Miner, type MinersHistory } from "@/schemas/minerSchema";
import { formatTimeOnly } from "@/utils/format";
import { type MinerStatus } from "@/utils/minerStatus";

import { SectionLabel } from "../SectionLabel";

import { FleetChart, type FleetPoint } from "./FleetChart";
import { FleetHealth } from "./FleetHealth";
import { FleetKpis } from "./FleetKpis";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const timeLabel = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

/** Every miner's series added up, bucket by bucket. A bucket where no miner
 * reported at all stays null (a gap), not zero. */
const fleetPoints = (history: MinersHistory | undefined): FleetPoint[] => {
  if (!history?.miners.length) return [];
  const start = new Date(history.from).getTime();
  return history.miners[0].hashRate.map((_, i) => {
    const values = history.miners
      .map((m) => m.hashRate[i])
      .filter((v) => v !== null);
    return {
      time: timeLabel.format(start + i * history.bucketSeconds * 1000),
      hashRate: values.length ? sum(values) : null,
    };
  });
};

interface FleetSummaryProps {
  miners: Miner[];
  devices: PowerDevice[];
  history: MinersHistory | undefined;
  /** See useMinerStatus. */
  isStale: (timestamp: string) => boolean;
  statusOf: (miner: Miner) => MinerStatus;
  onOpen: (ip: string) => void;
}

export const FleetSummary = ({
  miners,
  devices,
  history,
  isStale,
  statusOf,
  onOpen,
}: FleetSummaryProps) => {
  const { t } = useTranslation();

  // An unreachable miner's latest.json still holds its last readings --
  // counting them would overstate what the fleet does right now.
  const online = miners.filter((m) => m.alive !== false);
  const hashRate = sum(online.map((m) => m.hashRateTHs));

  const points = fleetPoints(history);
  const known = points.flatMap((p) =>
    p.hashRate === null ? [] : [p.hashRate],
  );
  const average = known.length ? sum(known) / known.length : null;

  const lastPoll = miners.reduce(
    (latest, m) => (m.timestamp > latest ? m.timestamp : latest),
    "",
  );
  // Even the most recent reading is late: the feeder itself has stopped.
  const isFeedStale = isStale(lastPoll);

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0,1fr)",
          md: "minmax(0,1.5fr) minmax(0,1fr)",
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 2.5 },
          pt: { xs: 2, md: 2.5 },
          pb: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: { md: 1 },
          borderBottom: { xs: 1, md: 0 },
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            columnGap: 2,
            rowGap: 1.25,
            mb: { xs: 1.5, md: 0 },
          }}
        >
          <SectionLabel icon="hashrate">
            {t("dashboard.fleet.hashrate24h")}
          </SectionLabel>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FleetHealth miners={miners} statusOf={statusOf} onOpen={onOpen} />
            {lastPoll && (
              <Tooltip
                title={t("dashboard.fleet.lastPoll", {
                  value: formatTimeOnly(lastPoll),
                })}
                arrow
              >
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: isFeedStale ? "error.main" : "text.secondary",
                  }}
                >
                  <SyncIcon sx={{ fontSize: 14 }} />
                  {formatTimeOnly(lastPoll)}
                </Typography>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "2.25rem", md: "2.75rem" },
              fontWeight: 600,
              lineHeight: 1.1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hashRate.toFixed(2)}
            <Typography
              component="span"
              sx={{ color: "text.secondary", ml: 1 }}
            >
              TH/s
            </Typography>
          </Typography>
          {average !== null && (
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.fleet.average", { value: average.toFixed(2) })}
            </Typography>
          )}
        </Box>
        <FleetChart points={points} />
      </Box>

      <FleetKpis miners={miners} devices={devices} />
    </Paper>
  );
};
