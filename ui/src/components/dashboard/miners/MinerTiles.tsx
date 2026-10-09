import { Box } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { type MinerStatus } from "@/utils/minerStatus";

import { MinerTile } from "./MinerTile";

interface MinerTilesProps {
  miners: Miner[];
  hashRateHistory: Map<string, (number | null)[]>;
  statusOf: (miner: Miner) => MinerStatus;
  onOpen: (ip: string) => void;
}

export const MinerTiles = ({
  miners,
  hashRateHistory,
  statusOf,
  onOpen,
}: MinerTilesProps) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: 2,
    }}
  >
    {miners.map((miner) => (
      <MinerTile
        key={miner.macAddr || miner.ip}
        miner={miner}
        status={statusOf(miner)}
        hashRateHistory={hashRateHistory.get(miner.ip)}
        onOpen={onOpen}
      />
    ))}
  </Box>
);
