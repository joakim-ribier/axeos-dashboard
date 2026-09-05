// src/components/ui/AlertList.tsx
import { Alert, type AlertProps, Box, Stack, Typography } from "@mui/material";

interface AlertListProps {
  severity: AlertProps["severity"];
  /** Optional heading shown above the list, e.g. "This doesn't match what
   * the miner currently reports:". Omit for a bare list of items (see the
   * Settings page's top-of-page issues summary). */
  title?: React.ReactNode;
  /** One item per row -- a plain string or any inline content (e.g. a
   * translated string with an embedded <strong>). Nothing is rendered at
   * all when this is empty, so callers don't need their own length check. */
  items: React.ReactNode[];
}

/** A single filled, icon-less alert banner with its items laid out as a
 * bullet list (a small dot per row, drawn by hand rather than relying on
 * native <ul>/<li> markers, which don't reliably render inside MUI's
 * layout) -- the "one banner, several points" pattern used wherever this
 * app groups more than one problem into a single alert: the Settings
 * page's top-of-page issues summary, PoolEditor's per-miner pool-config
 * drift warning, and the Remote (hashboard) push-status errors.
 */
export const AlertList = ({ severity, title, items }: AlertListProps) => {
  if (items.length === 0) return null;

  return (
    <Alert severity={severity} variant="filled" icon={false}>
      {title && (
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
          {title}
        </Typography>
      )}
      <Stack spacing={0.5}>
        {items.map((item, index) => (
          <Box
            key={index}
            sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                flexShrink: 0,
                mt: "7px",
                backgroundColor: "currentColor",
              }}
            />
            <Typography variant="body2">{item}</Typography>
          </Box>
        ))}
      </Stack>
    </Alert>
  );
};
