import { Box, ButtonBase, Typography } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { type MinerStatus, STATUS_COLOR } from "@/utils/minerStatus";

import { StatusChip } from "../StatusChip";

import { FAN_GAUGE, MetricBar, TEMP_GAUGE } from "./MetricBar";
import { MinerIdentity } from "./MinerIdentity";
import { PoolLabel } from "./PoolLabel";
import { Sparkline } from "./Sparkline";

interface MinerTileProps {
  miner: Miner;
  status: MinerStatus;
  hashRateHistory?: (number | null)[];
  onOpen: (ip: string) => void;
}

export const MinerTile = ({
  miner,
  status,
  hashRateHistory,
  onOpen,
}: MinerTileProps) => {
  return (
    // A div rather than a <button>: the pool link inside it couldn't be
    // nested in a real button.
    <ButtonBase
      component="div"
      onClick={() => onOpen(miner.ip)}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 1.5,
        p: 2,
        textAlign: "left",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        borderTop: "3px solid",
        borderTopColor: STATUS_COLOR[status],
        bgcolor: "background.paper",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1,
        }}
      >
        <MinerIdentity miner={miner} />
        <StatusChip status={status} />
      </Box>
      <Box sx={{ opacity: status === "offline" ? 0.45 : 1 }}>
        <Typography
          sx={{
            fontSize: "1.6rem",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {miner.hashRateTHs.toFixed(2)}
          <Typography component="span" variant="caption" color="text.secondary">
            {" TH/s"}
          </Typography>
        </Typography>
        {hashRateHistory && (
          <Sparkline
            values={hashRateHistory}
            color="primary.main"
            height={36}
          />
        )}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1.5,
          opacity: status === "offline" ? 0.45 : 1,
        }}
      >
        <MetricBar value={miner.temp} {...TEMP_GAUGE} />
        <MetricBar value={miner.fanspeed} {...FAN_GAUGE} />
        <Box>
          <Typography variant="body2">{`${miner.power.toFixed(1)} W`}</Typography>
          <Typography variant="caption" color="text.secondary">
            {`${miner.energyJPerTh.toFixed(1)} J/TH`}
          </Typography>
        </Box>
        <PoolLabel miner={miner} />
      </Box>
    </ButtonBase>
  );
};
