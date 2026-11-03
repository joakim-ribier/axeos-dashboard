// src/components/ui/SidePanel.tsx
import { useRef } from "react";
import { Drawer } from "@mui/material";

/** The app's panel sliding in from the right -- a miner's details, a
 * miner's configuration: full width on a phone, where a swipe right closes
 * it like its close button. Only the release is looked at -- the panel
 * doesn't follow the finger, so it leaves with its regular slide-out
 * instead of snapping back first. */
export const SidePanel = ({
  open,
  onClose,
  width = 540,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Its width past a phone's. */
  width?: number;
  children: React.ReactNode;
}) => {
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
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          onTouchStart,
          onTouchEnd,
          sx: {
            width: { xs: "100%", sm: width },
            maxWidth: "100%",
            bgcolor: "background.default",
            backgroundImage: "none",
          },
        },
      }}
    >
      {children}
    </Drawer>
  );
};
