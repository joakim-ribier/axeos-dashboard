// src/components/layout/Sidebar.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import {
  Box,
  Chip,
  Drawer,
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
import { useBuildSHA } from "@/hooks/useMiners";
import { createAutoRefreshToggledNotification } from "@/utils/minerNotifications";

export const SIDEBAR_WIDTH = 240;

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

interface SidebarContentProps {
  onItemClick?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ onItemClick }) => {
  const { t } = useTranslation();
  const buildSHA = useBuildSHA();
  const location = useLocation();
  const boardId = location.pathname.slice(1) || undefined;
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
        onClick={() => window.location.reload()}
        title={t("nav.refreshPage")}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 0.75,
          px: 2,
          py: 3,
          cursor: "pointer",
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
        <Box sx={{ display: "flex", justifyContent: "center", pb: 2, mt: -1 }}>
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

      <List sx={{ px: 2, pt: 2 }}>
        <ListItemButton
          selected
          onClick={onItemClick}
          sx={{
            borderRadius: 2,
            py: 0.75,
            px: 1.25,
            minHeight: 40,
            color: "primary.main",
            "&.Mui-selected": {
              bgcolor: "rgba(0,180,255,0.12)",
              "&:hover": { bgcolor: "rgba(0,180,255,0.16)" },
            },
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 32 }}>
            <DashboardIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t("nav.home")}
            primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 400 }}
          />
        </ListItemButton>
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
              gap: 0.25,
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
              build {buildSHA}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
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
        <SidebarContent onItemClick={onClose} />
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
        <SidebarContent />
      </Drawer>
    </Box>
  );
};
