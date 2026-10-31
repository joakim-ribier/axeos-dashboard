// src/components/layout/TopBar.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SyncIcon from "@mui/icons-material/Sync";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import {
  Badge,
  Box,
  Button,
  Collapse,
  IconButton,
  Popover,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { useAlerts, useMarkAlertsSeen } from "@/hooks/useAlerts";
import { formatTimestamp } from "@/utils/format";
import {
  alertColor,
  alertText,
  alertWhen,
  createAutoRefreshToggledNotification,
} from "@/utils/minerNotifications";

interface TopBarProps {
  onMenuClick: () => void;
  /** Receives the element the current page's PageHeader renders into. */
  titleSlotRef: (el: HTMLElement | null) => void;
}

const DOCS_URL_FR = "https://joakim-ribier.github.io/axeos-dashboard/";
const DOCS_URL_EN = "https://joakim-ribier.github.io/axeos-dashboard/en/";

const DocsLink: React.FC = () => {
  const { t, i18n } = useTranslation();
  const label = t("topBar.docs");
  const docsUrl = i18n.language.startsWith("fr") ? DOCS_URL_FR : DOCS_URL_EN;

  return (
    <Tooltip title={label}>
      <IconButton
        component="a"
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: "text.secondary" }}
        aria-label={label}
      >
        <MenuBookIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};

// The auto-refresh switch itself: a click turns it on or off. Next to the
// bell since it says whether the bell (and the data behind it) is still
// being kept live.
const AutoRefreshToggle: React.FC = () => {
  const { t } = useTranslation();
  const { autoRefreshEnabled, setAutoRefreshEnabled } = useRefreshSettings();
  const { addNotifications } = useNotifications();
  const label = autoRefreshEnabled
    ? t("topBar.autoRefreshOn")
    : t("topBar.autoRefreshOff");

  const toggle = () => {
    const next = !autoRefreshEnabled;
    setAutoRefreshEnabled(next);
    addNotifications([
      createAutoRefreshToggledNotification(
        next ? t("common.on") : t("common.off"),
      ),
    ]);
  };

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        onClick={toggle}
        aria-label={label}
        aria-pressed={autoRefreshEnabled}
        sx={{ color: autoRefreshEnabled ? "primary.main" : "text.disabled" }}
      >
        {autoRefreshEnabled ? (
          <SyncIcon fontSize="small" />
        ) : (
          <SyncDisabledIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
};

interface BellItem {
  id: string;
  timestamp: number;
  color?: string;
  text: string;
  when: string;
}

/**
 * The alerts raised and cleared (from the server, see useAlerts) and the
 * bell's own events (auto-refresh toggled, a new dashboard build), most
 * recent first. A click on it marks what it showed at that moment as read
 * -- on the server, so for every browser -- then fetches the alerts again
 * (auto-refresh may be off): what that brings stays unread. "Clear" hides
 * everything up to now, in this browser.
 */
const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const { data, refetch } = useAlerts();
  const { mutate: markSeen } = useMarkAlertsSeen();
  const { notifications: local, clearedAt, clear } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const notifications: BellItem[] = [
    ...(data?.events ?? []).map((event) => ({
      id: `${event.mac}-${event.type}-${event.state}-${event.ts}`,
      timestamp: Date.parse(event.ts),
      color: alertColor(event),
      text: alertText(t, event),
      when: alertWhen(t, event),
    })),
    ...local.map((n) => ({
      id: n.id,
      timestamp: n.timestamp,
      text: t(`notifications.${n.type}`, { value: n.detail }),
      when: formatTimestamp(String(n.timestamp)),
    })),
  ]
    .filter((n) => n.timestamp > clearedAt)
    .sort((a, b) => b.timestamp - a.timestamp);

  const seenAt = Date.parse(data?.seenAt ?? "") || 0;
  const unreadCount = notifications.filter((n) => n.timestamp > seenAt).length;
  const latest = notifications[0]?.timestamp ?? 0;
  const openNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (latest > seenAt) markSeen(latest);
    void refetch();
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
          {notifications.length > 0 && (
            <Button
              size="small"
              onClick={() => clear(latest)}
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
                {n.color && (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      flexShrink: 0,
                      mt: "5px",
                      backgroundColor: n.color,
                    }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" component="div">
                    {n.text}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="div"
                    color="text.secondary"
                    sx={{ fontSize: "0.7rem" }}
                  >
                    {n.when}
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

// Stays on screen while the page scrolls. On a phone only the status icons
// (auto-refresh, the bell's badge) stay next to the page title, the rest
// unfolds below the bar.
export const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  titleSlotRef,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // Folds back on every navigation.
  const [shownPathname, setShownPathname] = useState(pathname);
  if (shownPathname !== pathname) {
    setShownPathname(pathname);
    setMoreOpen(false);
  }

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: "appBar",
        bgcolor: "background.default",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, sm: 2 },
          px: 2,
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

        <Box ref={titleSlotRef} sx={{ flexGrow: 1, minWidth: 0 }} />

        {!isMobile && <DocsLink />}

        <AutoRefreshToggle />

        <NotificationBell />

        {isMobile ? (
          <IconButton
            onClick={() => setMoreOpen((open) => !open)}
            edge="end"
            aria-label={t("topBar.more")}
            aria-expanded={moreOpen}
            sx={{ color: moreOpen ? "primary.main" : "text.secondary" }}
          >
            <MoreVertIcon />
          </IconButton>
        ) : (
          <LanguageSwitcher />
        )}
      </Toolbar>

      {isMobile && (
        <Collapse in={moreOpen}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 2,
              px: 2,
              pb: 1.5,
            }}
          >
            <DocsLink />
            <LanguageSwitcher />
          </Box>
        </Collapse>
      )}
    </Box>
  );
};
