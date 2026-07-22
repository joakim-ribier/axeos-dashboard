// src/components/layout/TopBar.tsx
import React from "react";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SearchIcon from "@mui/icons-material/Search";
import { Badge, Box, IconButton, InputBase, Toolbar } from "@mui/material";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface TopBarProps {
  onMenuClick: () => void;
}

const SearchField: React.FC<{ sx?: object }> = ({ sx }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      bgcolor: "background.paper",
      borderRadius: 2,
      px: 1.5,
      py: 0.5,
      ...sx,
    }}
  >
    <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
    <InputBase
      placeholder="Search…"
      disabled
      sx={{ color: "text.primary", fontSize: "0.875rem", width: "100%" }}
    />
  </Box>
);

/**
 * Search and notifications are visual placeholders for now — no real search
 * target or alert wiring yet (that needs new backend signals, e.g. miner
 * overheating or a stale feeder). This just prepares the shell for it.
 *
 * On mobile the search field drops to its own row below the icons/language
 * row — there isn't enough width to keep everything on one line once the
 * hamburger and language switcher are both present.
 */
export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  return (
    <Toolbar
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: { xs: 1, sm: 2 },
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 0 },
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}
      >
        <IconButton
          onClick={onMenuClick}
          edge="start"
          aria-label="open navigation menu"
          sx={{ display: { sm: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        <SearchField
          sx={{
            display: { xs: "none", sm: "flex" },
            flexGrow: 1,
            maxWidth: 320,
          }}
        />

        <Box sx={{ flexGrow: 1 }} />

        <IconButton
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            color: "text.secondary",
          }}
          aria-label="notifications"
        >
          <Badge variant="dot" color="primary" invisible>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>

        <LanguageSwitcher />
      </Box>

      <SearchField sx={{ display: { xs: "flex", sm: "none" } }} />
    </Toolbar>
  );
};
