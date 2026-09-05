// src/components/ui/DataTable.tsx
import { Box, type SxProps, Table, type Theme } from "@mui/material";

interface DataTableProps {
  children: React.ReactNode;
  /** Applied to the outer scroll wrapper, not the table itself -- e.g. a
   * caller sitting above more content below it (rather than being the
   * last thing in its section) passing `sx={{ mb: 2 }}`. */
  sx?: SxProps<Theme>;
}

/** The wrapper every table on the app shares: `size="small"`, a
 * horizontal-scroll fallback (rather than wrapping/overflowing the page)
 * on a narrow screen, and no border under the last body row -- MUI gives
 * every row one by default, which just reads as a stray line once nothing
 * else follows the table. One component so a new table doesn't have to
 * remember any of this by hand, and so every table's rows get the same
 * size/spacing for free. Table*Head/Body/Row/Cell are still used directly
 * as children -- this only wraps the outer shell, same reasoning as
 * AlertList only wrapping the alert shell around arbitrary items.
 */
export const DataTable = ({ children, sx }: DataTableProps) => (
  <Box sx={{ overflowX: "auto", ...sx }}>
    <Table
      size="small"
      sx={{
        "& tbody tr:last-child td, & tbody tr:last-child th": { border: 0 },
      }}
    >
      {children}
    </Table>
  </Box>
);
