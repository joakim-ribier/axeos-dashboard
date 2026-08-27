// src/components/layout/Sidebar.tsx
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LockIcon from "@mui/icons-material/Lock";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublicIcon from "@mui/icons-material/Public";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import WifiFindIcon from "@mui/icons-material/WifiFind";
import {
  Box,
  Chip,
  Drawer,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";

import { useNotifications } from "@/contexts/NotificationsContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { useAppInfo, useUiFeatures } from "@/hooks/useMiners";
import {
  type AppVersionStatus,
  shouldNotifyForAppUpdate,
} from "@/utils/appVersion";
import { boardIdFromPathname } from "@/utils/boardId";
import {
  createAppUpdateAvailableNotification,
  createAutoRefreshToggledNotification,
} from "@/utils/minerNotifications";

const APP_VERSION_STATUS_STORAGE_KEY = "axeos.appVersionStatus";

const loadPreviousAppVersionStatus = (): AppVersionStatus | undefined => {
  try {
    const raw = localStorage.getItem(APP_VERSION_STATUS_STORAGE_KEY);
    return raw === "unknown" || raw === "upToDate" || raw === "updateAvailable"
      ? raw
      : undefined;
  } catch {
    return undefined;
  }
};

const savePreviousAppVersionStatus = (status: AppVersionStatus): void => {
  try {
    localStorage.setItem(APP_VERSION_STATUS_STORAGE_KEY, status);
  } catch {
    // best-effort
  }
};

export const SIDEBAR_WIDTH = 240;

interface NavItemProps {
  to: string;
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledHint?: string;
}

const NavItem: React.FC<NavItemProps> = ({
  to,
  selected,
  icon,
  label,
  onClick,
  disabled = false,
  disabledHint,
}) => {
  const button = (
    <ListItemButton
      component={RouterLink}
      to={to}
      selected={selected}
      disabled={disabled}
      // A disabled MUI ListItemButton already greys itself out and blocks
      // pointer events via its own styles, but the underlying element is
      // still a react-router <a href> -- tabIndex + swallowing the click
      // stops keyboard activation and any navigation that might otherwise
      // slip through.
      tabIndex={disabled ? -1 : undefined}
      aria-disabled={disabled || undefined}
      onClick={disabled ? (e) => e.preventDefault() : onClick}
      sx={{
        borderRadius: 2,
        py: 0.75,
        px: 1.25,
        minHeight: 40,
        color: selected ? "primary.main" : "text.secondary",
        "&.Mui-selected": {
          bgcolor: "rgba(0,180,255,0.12)",
          "&:hover": { bgcolor: "rgba(0,180,255,0.16)" },
        },
      }}
    >
      <ListItemIcon sx={{ color: "inherit", minWidth: 32 }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={label}
        primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 400 }}
      />
    </ListItemButton>
  );

  if (!disabled || !disabledHint) return button;

  // A disabled element swallows hover/focus events, so the Tooltip needs a
  // non-disabled wrapper to actually anchor to.
  return (
    <Tooltip title={disabledHint} arrow placement="right">
      <span>{button}</span>
    </Tooltip>
  );
};

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

interface SidebarContentProps {
  buildSHA: string | undefined;
  versionStatus: "unknown" | "upToDate" | "updateAvailable";
  releaseUrl: string | null;
  hashboardUrl: string | null;
  isPublic: boolean;
  onItemClick?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  buildSHA,
  versionStatus,
  releaseUrl,
  hashboardUrl,
  isPublic,
  onItemClick,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const boardId = boardIdFromPathname(location.pathname);
  const { ui } = useUiFeatures();
  const { autoRefreshEnabled, setAutoRefreshEnabled } = useRefreshSettings();
  const { addNotifications } = useNotifications();

  const handleAutoRefreshChange = (checked: boolean) => {
    setAutoRefreshEnabled(checked);
    addNotifications([
      createAutoRefreshToggledNotification(
        checked ? t("common.on") : t("common.off"),
      ),
    ]);
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box
        component={RouterLink}
        to={boardId ? `/${boardId}` : "/"}
        title={t("nav.home")}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 0.75,
          px: 2,
          py: 3,
          textDecoration: "none",
          userSelect: "none",
          transition: "opacity 0.15s ease",
          "&:hover": { opacity: 0.75 },
        }}
      >
        <Typography
          component="span"
          sx={{
            color: "text.primary",
            fontFamily: "'Courier New', 'Courier', monospace",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          AxeOS
        </Typography>

        <Typography
          component="span"
          sx={{ color: "text.secondary", fontWeight: 800 }}
        >
          ·
        </Typography>

        <Typography
          component="span"
          sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          <Box component="span" sx={{ color: "text.primary" }}>
            D
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: "'Courier New', 'Courier', monospace",
              color: "primary.main",
              opacity: 0.55,
              fontWeight: 700,
            }}
          >
            #
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: "'Courier New', 'Courier', monospace",
              color: "primary.main",
            }}
          >
            hash
          </Box>
          <Box component="span" sx={{ color: "text.primary" }}>
            board
          </Box>
        </Typography>
      </Box>

      {boardId && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 0.5,
            pb: 2,
            mt: -1,
          }}
        >
          <Tooltip title={boardId} arrow>
            <Chip
              size="small"
              label={boardId}
              sx={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                height: 22,
                maxWidth: SIDEBAR_WIDTH - 32,
                color: "text.disabled",
                bgcolor: "rgba(255,255,255,0.06)",
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          </Tooltip>
          <Tooltip
            title={
              isPublic
                ? t("sidebar.boardPublicHint")
                : t("sidebar.boardPrivateHint")
            }
            arrow
          >
            <Box
              component="span"
              aria-label={isPublic ? "board is public" : "board is private"}
              sx={{
                display: "flex",
                color: isPublic ? "success.main" : "warning.main",
              }}
            >
              {isPublic ? (
                <PublicIcon sx={{ fontSize: 14 }} />
              ) : (
                <LockIcon sx={{ fontSize: 14 }} />
              )}
            </Box>
          </Tooltip>
          {hashboardUrl && (
            <Tooltip title={t("sidebar.openHashboardAccount")} arrow>
              <Link
                href={`${hashboardUrl}/me`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="open hashboard account"
                sx={{ display: "flex", color: "text.disabled" }}
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Link>
            </Tooltip>
          )}
        </Box>
      )}

      <Box
        sx={{
          mx: 2,
          height: "1px",
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.14), transparent)",
        }}
      />

      <List
        sx={{
          px: 2,
          pt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <NavItem
          to={boardId ? `/${boardId}` : "/"}
          selected={location.pathname === (boardId ? `/${boardId}` : "/")}
          icon={<DashboardIcon sx={{ fontSize: 18 }} />}
          label={t("nav.home")}
          onClick={onItemClick}
        />
        <NavItem
          to={boardId ? `/${boardId}/alerts` : "/alerts"}
          selected={
            location.pathname === (boardId ? `/${boardId}/alerts` : "/alerts")
          }
          icon={<NotificationsActiveIcon sx={{ fontSize: 18 }} />}
          label={t("nav.alerts")}
          onClick={onItemClick}
        />
        {/* Hidden outright (not just greyed out) when this instance's own
            config says so (ui.page.settings: hidden, see config.UIConfig)
            -- e.g. remote-dashboard-api, which advertises nothing for a
            page whose route also 404s, see RequireSettingsEnabled. Miner
            config is otherwise a local-server concept (its own
            miners.yml): a remote board has no config of its own to edit,
            so on an instance where Settings *is* enabled the entry stays
            visible (so it isn't a surprise once back on the local
            dashboard) but greyed out and inert while viewing one. */}
        {ui.page.settings !== "hidden" && (
          <NavItem
            to="/settings"
            selected={location.pathname === "/settings"}
            icon={<WifiFindIcon sx={{ fontSize: 18 }} />}
            label={t("nav.settings")}
            onClick={onItemClick}
            disabled={!!boardId}
            disabledHint={
              boardId ? t("nav.settingsUnavailableRemote") : undefined
            }
          />
        )}
      </List>

      <Box
        sx={{
          mx: 2,
          height: "1px",
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.14), transparent)",
        }}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.25,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("nav.autoRefresh")}
        </Typography>
        <Switch
          size="small"
          checked={autoRefreshEnabled}
          onChange={(e) => handleAutoRefreshChange(e.target.checked)}
          slotProps={{ input: { "aria-label": "auto-refresh" } }}
        />
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      {buildSHA && (
        <>
          <Box
            sx={{
              mx: 2,
              height: "1px",
              background:
                "linear-gradient(to right, transparent, rgba(255,255,255,0.14), transparent)",
            }}
          />
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.75,
              pt: 1.5,
              pb: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                fontFamily: "monospace",
                opacity: 0.6,
              }}
            >
              {t("sidebar.versionLabel", { sha: buildSHA })}
            </Typography>

            {versionStatus === "upToDate" && (
              <Tooltip title={t("sidebar.versionUpToDate")} arrow>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: "text.disabled",
                    opacity: 0.6,
                  }}
                >
                  <CheckCircleOutlineIcon sx={{ fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
                    {t("sidebar.versionUpToDate")}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {versionStatus === "updateAvailable" && releaseUrl && (
              <Tooltip title={t("sidebar.versionUpdateAvailableHint")} arrow>
                <Chip
                  icon={
                    <SystemUpdateAltIcon sx={{ fontSize: "14px !important" }} />
                  }
                  label={t("sidebar.versionUpdateAvailable")}
                  size="small"
                  color="warning"
                  clickable
                  component="a"
                  href={releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="app update available"
                  sx={{ height: 22, fontSize: "0.7rem", borderRadius: 1 }}
                />
              </Tooltip>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
  // Called once here (rather than inside SidebarContent, which mounts
  // twice -- once for the mobile drawer, once for the desktop permanent
  // drawer) so the one-shot "update available" notification doesn't
  // double-fire across both instances.
  const { buildSHA, versionStatus, releaseUrl, hashboardUrl, isPublic } =
    useAppInfo();
  const { addNotifications } = useNotifications();

  // The actual GitHub check happens server-side (see internal/appversion),
  // checked at most once a day and piggybacked on the already-polled
  // /api/miners response. This just tracks the transition into
  // "updateAvailable" to fire a one-shot notification per browser --
  // persisted so a page reload doesn't re-notify for a status that was
  // already known before the reload (same reasoning as the miner
  // notifications' snapshot persistence).
  const previousVersionStatusRef = useRef<AppVersionStatus | undefined>(
    loadPreviousAppVersionStatus(),
  );
  useEffect(() => {
    if (versionStatus === "unknown") return;
    if (
      shouldNotifyForAppUpdate(previousVersionStatusRef.current, versionStatus)
    ) {
      addNotifications([createAppUpdateAvailableNotification()]);
    }
    previousVersionStatusRef.current = versionStatus;
    savePreviousAppVersionStatus(versionStatus);
  }, [versionStatus, addNotifications]);

  return (
    <Box
      component="nav"
      sx={{ width: { sm: SIDEBAR_WIDTH }, flexShrink: { sm: 0 } }}
    >
      {/* Mobile: temporary overlay drawer, toggled from TopBar's hamburger button */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: SIDEBAR_WIDTH,
          },
        }}
      >
        <SidebarContent
          buildSHA={buildSHA}
          versionStatus={versionStatus}
          releaseUrl={releaseUrl}
          hashboardUrl={hashboardUrl}
          isPublic={isPublic}
          onItemClick={onClose}
        />
      </Drawer>

      {/* Desktop: permanent, always-visible drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: SIDEBAR_WIDTH,
            borderRight: "1px solid rgba(255,255,255,0.08)",
          },
        }}
      >
        <SidebarContent
          buildSHA={buildSHA}
          versionStatus={versionStatus}
          releaseUrl={releaseUrl}
          hashboardUrl={hashboardUrl}
          isPublic={isPublic}
        />
      </Drawer>
    </Box>
  );
};
