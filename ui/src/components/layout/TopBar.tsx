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
import { useActiveAlerts, useAlertResolutionEffect } from "@/hooks/useAlerts";
import { formatTimestamp } from "@/utils/format";
import {
  activeAlertsToNotifications,
  ALERT_TYPE_COLOR,
  type MinerNotification,
} from "@/utils/minerNotifications";

interface TopBarProps {
  onMenuClick: () => void;
}

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

/**
 * Merges two sources that behave differently on purpose:
 *  - Currently active alerts (temp/fan/offline/mismatch/firmware) are
 *    recomputed from the live server feed on every render -- see
 *    activeAlertsToNotifications. They're never persisted as a one-off
 *    event, so there's no stale/lost-event state possible: as long as the
 *    condition is still true server-side, the row is there, page reload or
 *    not. They also aren't affected by "Clear" for the same reason -- it's
 *    not a dismissible event, it's live status.
 *  - Everything else (an alert *resolving*, auto-refresh toggled, a new
 *    dashboard build available) is a one-off event, pushed into
 *    NotificationsContext once and persisted there until "Clear".
 */
const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const miners = useActiveAlerts();
  useAlertResolutionEffect();
  const {
    notifications: events,
    clear,
    readIds,
    markRead,
  } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const notifications: MinerNotification[] = [
    ...activeAlertsToNotifications(miners),
    ...events,
  ].sort((a, b) => b.timestamp - a.timestamp);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  // Marks everything currently on screen as read -- a still-ongoing alert
  // keeps the same deterministic id (see activeAlertsToNotifications), so
  // it won't re-trigger the badge on its own; only a genuinely new id
  // (a different alert, a resolution, a new episode) will.
  const openNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    markRead(notifications.map((n) => n.id));
  };

  return (
    <>
      <IconButton
        onClick={openNotifications}
        sx={{ color: "text.secondary" }}
        aria-label="notifications"
      >
        <Badge
          badgeContent={unreadCount}
          max={99}
          color="error"
          invisible={unreadCount === 0}
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
          {events.length > 0 && (
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
                {ALERT_TYPE_COLOR[n.type] && (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      flexShrink: 0,
                      mt: "5px",
                      backgroundColor: ALERT_TYPE_COLOR[n.type],
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
