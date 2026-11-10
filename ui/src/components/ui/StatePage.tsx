// src/components/ui/StatePage.tsx
import { type ReactNode } from "react";
import { type SvgIconComponent } from "@mui/icons-material";
import { alpha, Box, Paper, Typography, useTheme } from "@mui/material";

import { GradientBar } from "./PageHeader/GradientBar";

interface StatePageProps {
  icon: SvgIconComponent;
  /** The icon's, its halo's and the bar's color. */
  tone: "primary" | "warning";
  title: string;
  message: string;
  children?: ReactNode;
}

/** A page with nothing to show but where it stands -- a private board to
 * unlock, a fleet with no data yet: a centered card, its icon in a halo,
 * the title over a short bar, a line saying what's going on, and what to do
 * about it if anything (children). */
export const StatePage = ({
  icon: Icon,
  tone,
  title,
  message,
  children,
}: StatePageProps) => {
  const theme = useTheme();
  const color = theme.palette[tone];

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
        px: 2,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: { xs: 4, sm: 6 },
          maxWidth: 440,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2.5,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(color.main, 0.12),
          }}
        >
          <Icon sx={{ fontSize: 44, color: color.main }} />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
          <Box sx={{ width: 48, my: 1.25 }}>
            <GradientBar height={4} colors={[color.main, color.dark]} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Box>
        {children}
      </Paper>
    </Box>
  );
};
