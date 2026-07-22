// src/components/ui/PageHeader/PageHeader.tsx
import React from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import { GradientBar } from "./GradientBar";
import { PageHeaderProps } from "./types";

/**
 * Reusable page header.
 * Handles mobile detection internally and allows forcing the visibility
 * of actions on mobile via the `forceShowActions` prop.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon,
  description,
  titleBadge,
  actions = [],
  forceShowActions = false,
  showHeader = true,
  sx = {},
  gradientProps = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const LeftIcon = icon ?? <DashboardIcon fontSize="large" />;

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        px: { xs: 2, md: 3 },
        ...sx,
      }}
    >
      <Stack spacing={0.5}>
        {showHeader && (
          <>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ mr: 1 }}>{LeftIcon}</Box>
              <Typography
                variant="h5"
                component="h2"
                color="text.primary"
                sx={{ lineHeight: 1.2 }}
              >
                {title}
              </Typography>
              {titleBadge}
            </Box>
            <GradientBar {...gradientProps} />
            {description && (
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {description}
              </Typography>
            )}
          </>
        )}
      </Stack>

      {(!isMobile || forceShowActions) && actions.length > 0 && (
        <Stack direction="row" spacing={1}>
          {actions.map((action, idx) => (
            <React.Fragment key={idx}>{action}</React.Fragment>
          ))}
        </Stack>
      )}
    </Box>
  );
};
