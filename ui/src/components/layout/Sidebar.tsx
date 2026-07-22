// src/components/layout/Sidebar.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import { useBuildSHA } from "@/hooks/useMiners";

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
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 0.75,
          px: 2,
          py: 3,
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

      <Box sx={{ flexGrow: 1 }} />

      {(boardId || buildSHA) && (
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
            {boardId && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.disabled",
                  fontFamily: "monospace",
                  opacity: 0.6,
                }}
              >
                board {boardId.slice(0, 8)}
              </Typography>
            )}
            {buildSHA && (
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
            )}
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
