import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Drawer } from "@mui/material";

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

  // Swipe right to close on a phone, like the close button. Only the release
  // is looked at -- the panel doesn't follow the finger, so it leaves with
  // its regular slide-out instead of snapping back first.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = Math.abs(e.changedTouches[0].clientY - start.y);
    // A clear rightward swipe, not a vertical scroll that drifted sideways.
    if (dx > 80 && dx > dy * 2) onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open && miner !== undefined}
      onClose={onClose}
      slotProps={{
        paper: {
          onTouchStart,
          onTouchEnd,
          sx: {
            width: { xs: "100%", sm: 540 },
            bgcolor: "background.default",
            backgroundImage: "none",
          },
        },
      }}
    >
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
    </Drawer>
  );
};
