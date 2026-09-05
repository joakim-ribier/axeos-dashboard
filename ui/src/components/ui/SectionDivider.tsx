// src/components/ui/SectionDivider.tsx
import { Box, type SxProps, type Theme } from "@mui/material";

interface SectionDividerProps {
  sx?: SxProps<Theme>;
}

/** The hairline between stacked content blocks within the same panel --
 * e.g. the Electricity/Pool dashboards/Remote/Firmware blocks in App
 * settings, or the Alias/Pool/Scheduler editors in a configured miner's
 * expanded row. A 1px line that fades out at both ends (rather than a
 * plain full-width MUI Divider) -- one shared component so every such
 * separator in the app looks the same, instead of each call site
 * reimplementing the gradient by hand. No margin of its own: a caller
 * inside a spacing Stack (App settings) needs none, one placed directly
 * between siblings (Settings.tsx's expanded miner row) passes its own
 * `sx={{ my: ... }}`. Not meant for a dialog's own footer separator (see
 * ConfirmDialog), which plays a different structural role.
 */
export const SectionDivider = ({ sx }: SectionDividerProps) => (
  <Box
    sx={{
      height: "1px",
      background: (theme) =>
        `linear-gradient(to right, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
      ...sx,
    }}
  />
);
