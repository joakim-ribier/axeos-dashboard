import { Box, Chip, Paper, Typography } from "@mui/material";

import { type SectionIcon, SectionLabel } from "../SectionLabel";

export interface BreakdownSegment {
  key: string;
  label: string;
  /** The segment's share of the bar. */
  value: number;
  /** Shown next to the label, e.g. a count or a percentage. */
  detail: string;
  /** Any MUI sx color. */
  color: string;
}

interface BreakdownStripProps {
  icon: SectionIcon;
  title: string;
  hint?: string;
  segments: BreakdownSegment[];
  selected: string | null;
  /** Clicking the selected segment again clears the selection. */
  onSelect: (key: string | null) => void;
}

/** A proportional bar plus one chip per segment -- the chips double as
 * filters on the miner list below. */
export const BreakdownStrip = ({
  icon,
  title,
  hint,
  segments,
  selected,
  onSelect,
}: BreakdownStripProps) => (
  <Paper
    variant="outlined"
    sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}
  >
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 1,
      }}
    >
      <SectionLabel icon={icon}>{title}</SectionLabel>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
    <Box
      sx={{
        display: "flex",
        gap: "2px",
        height: 10,
        borderRadius: 5,
        overflow: "hidden",
        bgcolor: "action.hover",
      }}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <Box key={s.key} sx={{ flex: s.value, bgcolor: s.color }} />
        ))}
    </Box>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {segments.map((s) => (
        <Chip
          key={s.key}
          size="small"
          variant={selected === s.key ? "filled" : "outlined"}
          // A selected chip stays clickable even once its segment is empty
          // (the offline miner came back) -- or the filter couldn't be
          // cleared anymore.
          disabled={s.value === 0 && selected !== s.key}
          onClick={() => onSelect(selected === s.key ? null : s.key)}
          icon={
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: s.color,
              }}
            />
          }
          label={
            <>
              {s.label}
              <Box component="span" sx={{ color: "text.secondary", ml: 0.75 }}>
                {s.detail}
              </Box>
            </>
          }
          sx={{ borderRadius: 1, "& .MuiChip-icon": { ml: 1 } }}
        />
      ))}
    </Box>
  </Paper>
);
