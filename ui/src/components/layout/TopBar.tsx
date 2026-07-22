// src/components/layout/TopBar.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SearchIcon from "@mui/icons-material/Search";
import {
  Badge,
  Box,
  Button,
  IconButton,
  InputBase,
  Popover,
  Toolbar,
  Typography,
} from "@mui/material";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useSearch } from "@/contexts/SearchContext";
import { formatTimestamp } from "@/utils/format";

interface TopBarProps {
  onMenuClick: () => void;
}

const SearchHelpTooltip: React.FC = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="search syntax help"
      >
        <InfoOutlinedIcon fontSize="inherit" sx={{ color: "text.secondary" }} />
      </IconButton>

      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1, maxWidth: 280 } } }}
      >
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
      </Popover>
    </>
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
                  pb: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: "none", pb: 0 },
                }}
              >
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
            ))}
          </Box>
        )}
      </Popover>
    </>
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

        <NotificationBell />

        <LanguageSwitcher />
      </Box>

      <SearchField sx={{ display: { xs: "flex", sm: "none" } }} />
    </Toolbar>
  );
};
