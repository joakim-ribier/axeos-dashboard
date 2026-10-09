import { useTranslation } from "react-i18next";
import { Box, Paper, Typography } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { type MinerStatus } from "@/utils/minerStatus";

import { MinerRow, rowGridSx, wideOnly } from "./MinerRow";

interface MinerListProps {
  miners: Miner[];
  hashRateHistory: Map<string, (number | null)[]>;
  statusOf: (miner: Miner) => MinerStatus;
  onOpen: (ip: string) => void;
}

const COLUMNS = [
  ["identity", "dashboard.columns.miner"],
  ["hashrate", "dashboard.columns.hashrate"],
  ["temp", "dashboard.columns.temp"],
  ["fan", "dashboard.columns.fan"],
  ["power", "dashboard.columns.power"],
  ["pool", "dashboard.columns.pool"],
  ["firmware", "dashboard.columns.firmware"],
] as const;

export const MinerList = ({
  miners,
  hashRateHistory,
  statusOf,
  onOpen,
}: MinerListProps) => {
  const { t } = useTranslation();

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          ...rowGridSx,
          py: 1,
          pr: 2,
          bgcolor: "action.hover",
        }}
      >
        {COLUMNS.map(([area, label]) => (
          <Typography
            key={area}
            variant="caption"
            sx={{
              gridArea: area,
              color: "text.secondary",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              ...((area === "power" || area === "firmware") && wideOnly),
            }}
          >
            {t(label)}
          </Typography>
        ))}
      </Box>
      {miners.map((miner) => (
        <MinerRow
          key={miner.macAddr || miner.ip}
          miner={miner}
          status={statusOf(miner)}
          hashRateHistory={hashRateHistory.get(miner.ip)}
          onOpen={onOpen}
        />
      ))}
    </Paper>
  );
};
