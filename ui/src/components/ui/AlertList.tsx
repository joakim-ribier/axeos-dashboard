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

/** The small colored, rounded-square swatch (not a round dot) that marks
 * each point -- the exact shape hashboard.live itself uses for its own
 * up/down status indicator in its top bar (10x10, 3px radius, solid
 * fill), reused here as a decorative marker.
 */
const AlertBullet = () => (
  <Box
    sx={{
      width: 10,
      height: 10,
      borderRadius: "3px",
      flexShrink: 0,
      backgroundColor: "currentColor",
    }}
  />
);

/** A single filled, icon-less alert banner with its items laid out as a
 * bullet list (one AlertBullet per row, drawn by hand rather than relying
 * on native <ul>/<li> markers, which don't reliably render inside MUI's
 * layout) -- the "one banner, several points" pattern used wherever this
 * app groups more than one problem into a single alert: the Settings
 * page's top-of-page issues summary, PoolEditor's per-miner pool-config
 * drift warning, and the Remote (hashboard) push-status errors. A single
 * item with no title is centered instead -- that's just a standalone
 * message (e.g. an empty state), not a list.
 */
export const AlertList = ({ severity, title, items }: AlertListProps) => {
  if (items.length === 0) return null;
  const centered = !title && items.length === 1;

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
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: centered ? "center" : "flex-start",
              gap: 1,
            }}
          >
            <AlertBullet />
            <Typography variant="body2">{item}</Typography>
          </Box>
        ))}
      </Stack>
    </Alert>
  );
};
