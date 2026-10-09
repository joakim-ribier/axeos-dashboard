// src/components/ui/PageHeader/PageHeader.tsx
import React, { useContext } from "react";
import { createPortal } from "react-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { Box, Typography } from "@mui/material";

import { PageTitleSlotContext } from "@/components/layout/pageTitleSlot";

import { PageHeaderProps } from "./types";

/**
 * The page's icon, title and description, shown in the TopBar rather than
 * above the page. A phone has no room for the description.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon,
  description,
}) => {
  const slot = useContext(PageTitleSlotContext);

  if (!slot) return null;

  return createPortal(
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          position: "relative",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          color: "primary.main",
          "& svg": { fontSize: 20 },
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: 1,
            bgcolor: "primary.main",
            opacity: 0.15,
          },
        }}
      >
        {icon ?? <DashboardIcon />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          component="h1"
          noWrap
          sx={{ fontWeight: 600, lineHeight: 1.25 }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: { xs: "none", md: "block" } }}
          >
            {description}
          </Typography>
        )}
      </Box>
    </Box>,
    slot,
  );
};
