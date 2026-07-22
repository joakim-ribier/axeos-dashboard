// src/components/layout/TopBar.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SearchIcon from "@mui/icons-material/Search";
import {
  Badge,
  Box,
  IconButton,
  InputBase,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useSearch } from "@/contexts/SearchContext";

interface TopBarProps {
  onMenuClick: () => void;
}

const SearchHelpTooltip: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography
            variant="caption"
            component="div"
            sx={{ fontWeight: 700, mb: 0.5 }}
          >
            {t("search.helpTitle")}
          </Typography>
          <Typography variant="caption" component="div">
            {t("search.helpPlain")}
          </Typography>
          <Typography variant="caption" component="div">
            {t("search.helpCompare")}
          </Typography>
          <Typography variant="caption" component="div">
            {t("search.helpKeywords")}
          </Typography>
          <Typography variant="caption" component="div">
            {t("search.helpExclude")}
          </Typography>
          <Typography variant="caption" component="div">
            {t("search.helpCombine")}
          </Typography>
        </Box>
      }
    >
      <IconButton size="small" aria-label="search syntax help">
        <InfoOutlinedIcon fontSize="inherit" sx={{ color: "text.secondary" }} />
      </IconButton>
    </Tooltip>
  );
};

const SearchField: React.FC<{ sx?: object }> = ({ sx }) => {
  const { query, setQuery } = useSearch();

  return (
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
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ color: "text.primary", fontSize: "0.875rem", width: "100%" }}
      />
      <SearchHelpTooltip />
    </Box>
  );
};

/**
 * Notifications remain a visual placeholder for now — no backend signal
 * to wire up yet (e.g. miner overheating or a stale feeder).
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
