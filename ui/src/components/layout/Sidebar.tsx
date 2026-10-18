// src/components/layout/Sidebar.tsx
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";
import BackupIcon from "@mui/icons-material/Backup";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import LockIcon from "@mui/icons-material/Lock";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublicIcon from "@mui/icons-material/Public";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import WifiFindIcon from "@mui/icons-material/WifiFind";
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";

import { useNotifications } from "@/contexts/NotificationsContext";
import { useAppInfo, useUiFeatures } from "@/hooks/useMiners";
import { useRemoteBoard } from "@/hooks/useRemoteBoard";
import {
  type AppVersionStatus,
  shouldNotifyForAppUpdate,
} from "@/utils/appVersion";
import { createAppUpdateAvailableNotification } from "@/utils/minerNotifications";

import { ServicesStatusBlock } from "./ServicesStatus";

const MONO = "'Courier New', 'Courier', monospace";

/** "AxeOS · D#hashboard" -- or just its "#" in the folded sidebar rail. */
const Brand = ({ collapsed = false }: { collapsed?: boolean }) =>
  collapsed ? (
    <Typography
      component="span"
      sx={{ fontFamily: MONO, color: "primary.main", fontWeight: 800 }}
    >
      #
    </Typography>
  ) : (
    <>
      <Typography
        component="span"
        sx={{
          color: "text.primary",
          fontFamily: MONO,
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
            fontFamily: MONO,
            color: "primary.main",
            opacity: 0.55,
            fontWeight: 700,
          }}
        >
          #
        </Box>
        <Box component="span" sx={{ fontFamily: MONO, color: "primary.main" }}>
          hash
        </Box>
        <Box component="span" sx={{ color: "text.primary" }}>
          board
        </Box>
      </Typography>
    </>
  );

interface BoardInfo {
  id: string;
  /** Where the board's ID links to. */
  url: string;
  isPublic: boolean;
  hashboardUrl: string | null;
}

/**
 * A hashboard board's line: its ID (a link to it), public or private, and
 * a link to the hashboard account. external opens the board in a new tab --
 * from the local dashboard, which isn't that board.
 */
export const BoardChip = ({
  board,
  external = false,
  maxWidth,
}: {
  board: BoardInfo;
  external?: boolean;
  maxWidth?: number;
}) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      <Tooltip title={board.id} arrow>
        <Chip
          size="small"
          label={board.id}
          component="a"
          href={board.url}
          clickable
          {...(external && { target: "_blank", rel: "noopener noreferrer" })}
          sx={{
            fontFamily: "monospace",
            fontSize: "0.7rem",
            height: 22,
            borderRadius: 1,
            maxWidth,
            minWidth: 0,
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
          board.isPublic
            ? t("sidebar.boardPublicHint")
            : t("sidebar.boardPrivateHint")
        }
        arrow
      >
        <Box
          component="span"
          aria-label={board.isPublic ? "board is public" : "board is private"}
          sx={{
            display: "flex",
            color: board.isPublic ? "success.main" : "warning.main",
          }}
        >
          {board.isPublic ? (
            <PublicIcon sx={{ fontSize: 14 }} />
          ) : (
            <LockIcon sx={{ fontSize: 14 }} />
          )}
        </Box>
      </Tooltip>
      {board.hashboardUrl && (
        <Tooltip title={t("sidebar.openHashboardAccount")} arrow>
          <Link
            href={`${board.hashboardUrl}/me`}
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
  );
};

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
const SIDEBAR_RAIL_WIDTH = 64;

// Whether the desktop sidebar is folded into its icon rail -- a per-browser
// convenience, so it survives a reload but never leaves this browser.
const COLLAPSED_STORAGE_KEY = "axeos.sidebarCollapsed";

const loadCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const saveCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // best-effort
  }
};

interface NavItemProps {
  to: string;
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledHint?: string;
  /** Icon only, its label moving to a tooltip -- the collapsed rail. */
  collapsed?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({
  to,
  selected,
  icon,
  label,
  onClick,
  disabled = false,
  disabledHint,
  collapsed = false,
}) => {
  const button = (
    <ListItemButton
      component={RouterLink}
      to={to}
      selected={selected}
      disabled={disabled}
      aria-label={label}
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
        justifyContent: collapsed ? "center" : "flex-start",
        color: selected ? "primary.main" : "text.secondary",
        "&.Mui-selected": {
          bgcolor: "rgba(0,180,255,0.12)",
          "&:hover": { bgcolor: "rgba(0,180,255,0.16)" },
        },
      }}
    >
      <ListItemIcon
        sx={{
          color: "inherit",
          minWidth: collapsed ? 0 : 32,
          justifyContent: "center",
        }}
      >
        {icon}
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={label}
          primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 400 }}
        />
      )}
    </ListItemButton>
  );

  const hint = disabled && disabledHint ? disabledHint : collapsed ? label : "";
  if (!hint) return button;

  // A disabled element swallows hover/focus events, so the Tooltip needs a
  // non-disabled wrapper to actually anchor to.
  return (
    <Tooltip title={hint} arrow placement="right">
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
  onItemClick?: () => void;
  /** The desktop rail: icons only (see Sidebar). */
  collapsed?: boolean;
  /** Only the desktop drawer folds -- the mobile one is already a drawer. */
  onToggleCollapsed?: () => void;
}

interface SidebarFooterProps {
  buildSHA: string | undefined;
  versionStatus: AppVersionStatus;
  releaseUrl: string | null;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * The sidebar's foot, one row: the running version with its status (a
 * link to the release when one is newer), and the fold button. Folded,
 * only the status icon and the unfold button are left.
 */
const SidebarFooter: React.FC<SidebarFooterProps> = ({
  buildSHA,
  versionStatus,
  releaseUrl,
  collapsed,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();
  const updateUrl = versionStatus === "updateAvailable" ? releaseUrl : null;
  const statusText =
    versionStatus === "upToDate"
      ? t("sidebar.versionUpToDate")
      : updateUrl
        ? t("sidebar.versionUpdateAvailable")
        : null;
  const statusColor = updateUrl ? "warning.main" : "success.main";
  const statusIcon =
    versionStatus === "upToDate" ? (
      <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
    ) : updateUrl ? (
      <SystemUpdateAltIcon sx={{ fontSize: 18 }} />
    ) : null;
  const versionText = buildSHA
    ? t("sidebar.versionLabel", { sha: buildSHA })
    : null;

  if (!versionText && !onToggleCollapsed) return null;

  // A link to the release when there's one to get, plain text otherwise.
  const linkProps = updateUrl
    ? {
        component: "a" as const,
        href: updateUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": "app update available",
      }
    : {};

  const toggle = onToggleCollapsed && (
    <Tooltip
      title={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
      arrow
      placement="right"
    >
      <IconButton
        size="small"
        onClick={onToggleCollapsed}
        aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
        sx={{ color: "text.disabled" }}
      >
        {collapsed ? (
          <KeyboardDoubleArrowRightIcon fontSize="small" />
        ) : (
          <KeyboardDoubleArrowLeftIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );

  return (
    <>
      <Box
        sx={{
          mx: collapsed ? 1 : 2,
          height: "1px",
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.14), transparent)",
        }}
      />
      {collapsed ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            py: 1,
          }}
        >
          {versionText && statusIcon && (
            <Tooltip
              title={[versionText, statusText].filter(Boolean).join(" · ")}
              arrow
              placement="right"
            >
              <IconButton
                size="small"
                {...linkProps}
                aria-label={
                  updateUrl ? "app update available" : (statusText ?? undefined)
                }
                sx={{ color: statusColor }}
              >
                {statusIcon}
              </IconButton>
            </Tooltip>
          )}
          {toggle}
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: 2,
            pr: 1,
            py: 1.25,
          }}
        >
          {versionText && (
            <Box
              {...linkProps}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                minWidth: 0,
                flexGrow: 1,
                color: "inherit",
                textDecoration: "none",
                borderRadius: 2,
                ...(updateUrl && {
                  "&:hover .version-status": { textDecoration: "underline" },
                }),
              }}
            >
              {statusIcon && (
                <Box
                  component="span"
                  aria-label={statusText ?? undefined}
                  sx={{ display: "flex", color: statusColor }}
                >
                  {statusIcon}
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  noWrap
                  component="div"
                  sx={{ color: "text.secondary", fontFamily: "monospace" }}
                >
                  {versionText}
                </Typography>
                {statusText && (
                  <Typography
                    className="version-status"
                    variant="caption"
                    component="div"
                    sx={{
                      color: statusColor,
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    {statusText}
                    {updateUrl && <OpenInNewIcon sx={{ fontSize: 12 }} />}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          <Box sx={{ ml: "auto", flexShrink: 0 }}>{toggle}</Box>
        </Box>
      )}
    </>
  );
};

const SidebarContent: React.FC<SidebarContentProps> = ({
  buildSHA,
  versionStatus,
  releaseUrl,
  onItemClick,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { ui } = useUiFeatures();
  const { data: remoteBoard } = useRemoteBoard();
  // The board line under the brand: the hashboard board this dashboard
  // pushes to, once remote push is set up.
  const board: BoardInfo | null =
    remoteBoard?.boardId && remoteBoard.dashboardURL
      ? {
          id: remoteBoard.boardId,
          url: remoteBoard.dashboardURL,
          isPublic: remoteBoard.public,
          hashboardUrl: remoteBoard.hashboardURL ?? null,
        }
      : null;

  return (
    <Box
      sx={{
        // At least the drawer's height, more when a short screen makes it
        // scroll: the background must follow the content all the way down.
        // Never shrunk by the drawer's own flex column, or the overflow
        // spills over its lighter paper instead of scrolling.
        minHeight: "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      {/* A plain link, not a router one: the page reloads, as if arriving
          on the dashboard. */}
      <Box
        component="a"
        href="/"
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
          cursor: "pointer",
          transition: "opacity 0.15s ease",
          "&:hover": { opacity: 0.75 },
        }}
      >
        <Brand collapsed={collapsed} />
      </Box>

      {board && !collapsed && (
        <Box sx={{ display: "flex", justifyContent: "center", pb: 2, mt: -1 }}>
          <BoardChip board={board} external maxWidth={SIDEBAR_WIDTH - 32} />
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
          px: collapsed ? 1 : 2,
          pt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <NavItem
          to="/"
          selected={location.pathname === "/"}
          icon={<DashboardIcon sx={{ fontSize: 18 }} />}
          label={t("nav.home")}
          onClick={onItemClick}
          collapsed={collapsed}
        />
        <NavItem
          to="/alerts"
          selected={location.pathname === "/alerts"}
          icon={<NotificationsActiveIcon sx={{ fontSize: 18 }} />}
          label={t("nav.alerts")}
          onClick={onItemClick}
          collapsed={collapsed}
        />
        {/* Hidden outright (not just greyed out) when this instance's own
            config says so (ui.page.settings: hidden, see config.UIConfig)
            -- the route itself also 404s in that case, see
            RequirePageEnabled. */}
        {ui.page.settings !== "hidden" && (
          <NavItem
            to="/settings"
            selected={location.pathname.startsWith("/settings")}
            icon={<WifiFindIcon sx={{ fontSize: 18 }} />}
            label={t("nav.settings")}
            onClick={onItemClick}
            collapsed={collapsed}
          />
        )}
        {ui.page.backups !== "hidden" && (
          <NavItem
            to="/backups"
            selected={location.pathname === "/backups"}
            icon={<BackupIcon sx={{ fontSize: 18 }} />}
            label={t("nav.backups")}
            onClick={onItemClick}
            collapsed={collapsed}
          />
        )}
        {ui.page.audit !== "hidden" && (
          <NavItem
            to="/audit"
            selected={location.pathname === "/audit"}
            icon={<ManageHistoryIcon sx={{ fontSize: 18 }} />}
            label={t("nav.audit")}
            onClick={onItemClick}
            collapsed={collapsed}
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

      <ServicesStatusBlock collapsed={collapsed} />

      <Box sx={{ flexGrow: 1 }} />

      <SidebarFooter
        buildSHA={buildSHA}
        versionStatus={versionStatus}
        releaseUrl={releaseUrl}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    </Box>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
  // Called once here (rather than inside SidebarContent, which mounts
  // twice -- once for the mobile drawer, once for the desktop permanent
  // drawer) so the one-shot "update available" notification doesn't
  // double-fire across both instances.
  const { buildSHA, versionStatus, releaseUrl } = useAppInfo();
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

  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      saveCollapsed(!c);
      return !c;
    });
  };
  const desktopWidth = collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH;
  const widthTransition = "width 0.2s ease";

  return (
    <Box
      component="nav"
      sx={{
        width: { sm: desktopWidth },
        flexShrink: { sm: 0 },
        transition: widthTransition,
      }}
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
            width: desktopWidth,
            overflowX: "hidden",
            transition: widthTransition,
            borderRight: "1px solid rgba(255,255,255,0.08)",
          },
        }}
      >
        <SidebarContent
          buildSHA={buildSHA}
          versionStatus={versionStatus}
          releaseUrl={releaseUrl}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </Drawer>
    </Box>
  );
};
