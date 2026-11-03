// src/components/ui/UrlText.tsx
import { Box, Tooltip } from "@mui/material";

/** A URL on one line, cut short with "…" -- the whole of it on hover, or
 * on a tap on a phone. However long it is, its row keeps the same height. */
export const UrlText = ({ url }: { url: string }) => (
  <Tooltip title={url} enterTouchDelay={0} leaveTouchDelay={4000}>
    <Box
      component="span"
      sx={{
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontFamily: "monospace",
      }}
    >
      {url}
    </Box>
  </Tooltip>
);
