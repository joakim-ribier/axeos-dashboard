// src/components/ui/PageHeader/GradientBar/GradientBar.tsx
import React from "react";
import { Box, useTheme } from "@mui/material";

interface GradientBarProps {
  /** Height of the bar in pixels (default = 6) */
  height?: number;
  /** Border radius of the bar (default = 2) */
  radius?: number;
  /**
   * Optional custom colors for the gradient.
   * If omitted, the primary and primary.dark colors from the theme are used.
   */
  colors?: string[];
}

/**
 * A thin, static gradient bar.
 * Width is controlled by the parent element (usually an inline‑block wrapper).
 */
export const GradientBar: React.FC<GradientBarProps> = ({
  height = 6,
  radius = 2,
  colors,
}) => {
  const theme = useTheme();

  // Resolve colors – fallback to theme primary shades
  const resolvedColors = colors ?? [
    theme.palette.primary.main,
    theme.palette.primary.dark,
  ];

  return (
    <Box
      sx={{
        display: "block",
        height,
        background: `linear-gradient(to right, ${resolvedColors.join(", ")})`,
        borderRadius: radius,
        mb: 0.5, // small margin before the title
      }}
    />
  );
};
