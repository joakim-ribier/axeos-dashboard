import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";

import { SidePanel } from "@/components/ui/SidePanel";
import { type Miner } from "@/schemas/minerSchema";
import { type MinerStatus } from "@/utils/minerStatus";

import { DrawerSection } from "./DrawerSection";
import { MinerActions } from "./MinerActions";
import { MinerDetails } from "./MinerDetails";
import { MinerHeader } from "./MinerHeader";
import { MinerHistoryChart } from "./MinerHistoryChart";
import { MinerIssues } from "./MinerIssues";
import { MinerPools } from "./MinerPools";
import { MinerVitals } from "./MinerVitals";

interface MinerDrawerProps {
  open: boolean;
  miner: Miner | undefined;
  status: MinerStatus | undefined;
  hashRateHistory?: (number | null)[];
  onClose: () => void;
}

export const MinerDrawer = ({
  open,
  miner,
  status,
  hashRateHistory,
  onClose,
}: MinerDrawerProps) => {
  const { t } = useTranslation();

  return (
    <SidePanel open={open && miner !== undefined} onClose={onClose}>
      {miner && status && (
        <>
          <MinerHeader miner={miner} status={status} onClose={onClose} />
          <Box
            sx={{
              flex: 1,
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              overflowY: "auto",
            }}
          >
            <MinerIssues miner={miner} status={status} />
            <MinerVitals miner={miner} hashRateHistory={hashRateHistory} />
            <DrawerSection icon="history" title={t("miner.statsTimeline")}>
              <MinerHistoryChart ip={miner.ip} />
            </DrawerSection>
            {/* Keyed so the selected pool resets to the active one when
                another miner is opened. */}
            <MinerPools key={miner.ip} miner={miner} />
            <MinerDetails miner={miner} />
          </Box>
          <MinerActions miner={miner} />
        </>
      )}
    </SidePanel>
  );
};
