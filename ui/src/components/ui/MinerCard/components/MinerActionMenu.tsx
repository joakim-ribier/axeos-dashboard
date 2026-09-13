// src/components/ui/MinerCard/components/MinerActionMenu.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RestartAltOutlined } from "@mui/icons-material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";

import { UIVisibility } from "@/types/uiFeatures";

interface MinerActionMenuProps {
  isFallback: boolean;
  onSwitchPool: () => void;
  onRestart: () => void;
  isExecuting: boolean;
  /** "hidden": item isn't rendered. "readonly": rendered but disabled, with a hint explaining why. "enabled": normal. */
  switchPoolVisibility: UIVisibility;
  restartVisibility: UIVisibility;
}

/** A "..." menu button (top-right of the card) that hides the Switch/Restart
 * actions behind a click instead of showing them as a permanent row --
 * they're reached for occasionally, not something worth two buttons' worth
 * of space on every card in the grid, all the time. */
export const MinerActionMenu = ({
  isFallback,
  onSwitchPool,
  onRestart,
  isExecuting,
  switchPoolVisibility,
  restartVisibility,
}: MinerActionMenuProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const bothHidden =
    switchPoolVisibility === "hidden" && restartVisibility === "hidden";
  if (bothHidden) return null;

  const switchLabel = isFallback
    ? t("miner.actions.switchPool.toMain")
    : t("miner.actions.switchPool.toFallback");
  const disabledHint = t("miner.actions.disabledHint");

  const close = () => setAnchorEl(null);

  return (
    <>
      {/* A tab flush against the card's own top-right corner (sharing its
          8px radius on that one corner) -- reads as a fixture built into
          the card's own shape, not a loose icon floating among the title
          row's text. */}
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={t("miner.actions.menuLabel")}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 36,
          height: 32,
          color: "text.disabled",
          borderRadius: "0 8px 0 10px",
          backgroundColor: "rgba(255,255,255,0.06)",
          "&:hover": {
            color: "primary.main",
            backgroundColor: "rgba(0,180,255,0.14)",
          },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.25,
              minWidth: 160,
              overflow: "visible",
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundImage: "none",
              backgroundColor: (theme) => theme.palette.background.paper,
              // Arrow tethering the menu back to the "..." button it came
              // from -- without it the popover reads as floating in open
              // space rather than something that opened off that button.
              "&::before": {
                content: '""',
                position: "absolute",
                top: -5,
                right: 12,
                width: 10,
                height: 10,
                backgroundColor: (theme) => theme.palette.background.paper,
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                transform: "rotate(45deg)",
              },
            },
          },
          list: { sx: { py: 0.5 } },
        }}
      >
        {switchPoolVisibility !== "hidden" && (
          <Tooltip
            title={switchPoolVisibility === "readonly" ? disabledHint : ""}
            placement="left"
          >
            <span>
              <MenuItem
                onClick={() => {
                  close();
                  onSwitchPool();
                }}
                disabled={isExecuting || switchPoolVisibility === "readonly"}
                sx={{
                  gap: 0.5,
                  color: "#29b6f6",
                  "&:hover": { backgroundColor: "rgba(41,182,246,0.1)" },
                  "&.Mui-disabled": { color: "text.disabled" },
                }}
              >
                <ListItemIcon sx={{ color: "inherit" }}>
                  <SyncAltIcon fontSize="small" sx={{ color: "inherit" }} />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    variant: "body2",
                    color: "inherit",
                  }}
                >
                  {switchLabel}
                </ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
        )}
        {restartVisibility !== "hidden" && (
          <Tooltip
            title={restartVisibility === "readonly" ? disabledHint : ""}
            placement="left"
          >
            <span>
              <MenuItem
                onClick={() => {
                  close();
                  onRestart();
                }}
                disabled={isExecuting || restartVisibility === "readonly"}
                sx={{
                  gap: 0.5,
                  color: "#ffa726",
                  "&:hover": { backgroundColor: "rgba(255,167,38,0.1)" },
                  "&.Mui-disabled": { color: "text.disabled" },
                }}
              >
                <ListItemIcon sx={{ color: "inherit" }}>
                  <RestartAltOutlined
                    fontSize="small"
                    sx={{ color: "inherit" }}
                  />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    variant: "body2",
                    color: "inherit",
                  }}
                >
                  {t("miner.actions.restart.label")}
                </ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
        )}
      </Menu>
    </>
  );
};
