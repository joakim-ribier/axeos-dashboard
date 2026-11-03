// src/components/ui/RowList.tsx
import { Box, type BoxProps, Paper } from "@mui/material";

/** A list as the app's menus draw it -- one outlined card, its rows
 * separated by a line: the configured miners on a phone, a miner's
 * scheduled tasks. */
export const RowList = ({ children }: { children: React.ReactNode }) => (
  <Paper
    variant="outlined"
    sx={{
      borderRadius: 3,
      overflow: "hidden",
      "& > * + *": { borderTop: 1, borderColor: "divider" },
    }}
  >
    {children}
  </Paper>
);

/** One row of a RowList -- highlighted on hover when it opens something. */
export const Row = ({ onClick, sx, ...props }: BoxProps) => (
  <Box
    {...props}
    onClick={onClick}
    sx={[
      { px: 2, py: 1.25, typography: "body2" },
      !!onClick && {
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  />
);
