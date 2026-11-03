// src/components/ui/SectionLayout.tsx
import { Box } from "@mui/material";

// Two spacings for every Configuration page, so none reads differently
// from the next.

/** Between a page's blocks (separated by a divider). */
export const PAGE_GAP = 4;

/** Within a block: under its title, between its fields, its list, its
 * buttons. */
export const SECTION_GAP = 2.5;

/** Fields side by side -- one under the other on a phone, the same gap as
 * any other line of the block. */
export const ROW_SPACING = { xs: SECTION_GAP, sm: 2 };

/** A section's content, one block under the other. */
export const SectionStack = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: SECTION_GAP }}>
    {children}
  </Box>
);

/** A section's buttons, under its fields: side by side, each the full
 * width on a phone. */
export const SectionActions = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: { xs: "column", sm: "row" },
      alignItems: { xs: "stretch", sm: "center" },
      gap: 1.5,
    }}
  >
    {children}
  </Box>
);
