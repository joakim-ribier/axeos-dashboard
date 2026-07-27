// src/components/layout/TopBar.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SyncIcon from "@mui/icons-material/Sync";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import {
  Badge,
  Box,
  Button,
  IconButton,
  Popover,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { formatTimestamp } from "@/utils/format";
import type { NotificationType } from "@/utils/minerNotifications";

interface TopBarProps {
  onMenuClick: () => void;
}

// A red dot marks a "bad" state -- a threshold exceeded, or a miner gone
// offline. A green dot marks the same state resolved -- back under the
// threshold, or back online. version/updateAvailable/settingsUpdated are
// one-off events, not a two-sided state, so they stay plain text.
const NOTIFICATION_DOT_COLOR: Partial<Record<NotificationType, string>> = {
  temp: "#f44336",
  fan: "#f44336",
  offline: "#f44336",
  deviceError: "#ff9800",
  tempRecovered: "#66bb6a",
  fanRecovered: "#66bb6a",
  online: "#66bb6a",
  deviceErrorResolved: "#66bb6a",
};

// Passive status indicator, not a control -- the actual on/off toggle lives
// in the Sidebar. Placed next to the bell since it explains whether the
// bell (and the data behind it) is still being kept live.
const AutoRefreshIndicator: React.FC = () => {
  const { t } = useTranslation();
  const { autoRefreshEnabled } = useRefreshSettings();
  const label = autoRefreshEnabled
    ? t("topBar.autoRefreshOn")
    : t("topBar.autoRefreshOff");

  return (
    <Tooltip title={label}>
      <Box
        aria-label={label}
        sx={{
          display: "flex",
          alignItems: "center",
          color: autoRefreshEnabled ? "primary.main" : "text.disabled",
        }}
      >
        {autoRefreshEnabled ? (
          <SyncIcon fontSize="small" />
        ) : (
          <SyncDisabledIcon fontSize="small" />
        )}
      </Box>
    </Tooltip>
  );
};

const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const { notifications, clear } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: "text.secondary" }}
        aria-label="notifications"
      >
        <Badge
          badgeContent={notifications.length}
          max={99}
          color="error"
          invisible={notifications.length === 0}
        >
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>

      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { width: 300, maxWidth: "90vw", p: 1.5 } },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 0.75,
          }}
        >
          <Typography
            variant="caption"
            component="div"
            sx={{ fontWeight: 700 }}
          >
            {t("notifications.title")}
          </Typography>
          {notifications.length > 0 && (
            <Button
              size="small"
              onClick={clear}
              sx={{ minWidth: 0, py: 0, fontSize: "0.7rem" }}
            >
              {t("notifications.clear")}
            </Button>
          )}
        </Box>

        {notifications.length === 0 ? (
          <Typography variant="caption" component="div" color="text.secondary">
            {t("notifications.empty")}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {notifications.map((n) => (
              <Box
                key={n.id}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 0.75,
                  pb: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: "none", pb: 0 },
                }}
              >
                {NOTIFICATION_DOT_COLOR[n.type] && (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      flexShrink: 0,
                      mt: "5px",
                      backgroundColor: NOTIFICATION_DOT_COLOR[n.type],
                    }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" component="div">
                    {t(`notifications.${n.type}`, {
                      miner: n.minerLabel,
                      value: n.detail,
                    })}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="div"
                    color="text.secondary"
                    sx={{ fontSize: "0.7rem" }}
                  >
                    {formatTimestamp(String(n.timestamp))}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Popover>
    </>
  );
};

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  return (
    <Toolbar
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        px: { xs: 2, sm: 3 },
      }}
    >
      <IconButton
        onClick={onMenuClick}
        edge="start"
        aria-label="open navigation menu"
        sx={{ display: { sm: "none" } }}
      >
        <MenuIcon />
      </IconButton>

      <Box sx={{ flexGrow: 1 }} />

      <AutoRefreshIndicator />

      <NotificationBell />

      <LanguageSwitcher />
    </Toolbar>
  );
};
