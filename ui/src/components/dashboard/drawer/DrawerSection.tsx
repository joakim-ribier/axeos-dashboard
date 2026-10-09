import { Box, Paper } from "@mui/material";

import { type SectionIcon, SectionLabel } from "../SectionLabel";

interface DrawerSectionProps {
  icon: SectionIcon;
  title: string;
  children: React.ReactNode;
}

export const DrawerSection = ({
  icon,
  title,
  children,
}: DrawerSectionProps) => (
  <Paper
    variant="outlined"
    component="section"
    sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}
  >
    <SectionLabel icon={icon}>{title}</SectionLabel>
    {children}
  </Paper>
);

export const DetailList = ({ rows }: { rows: [string, React.ReactNode][] }) => (
  <Box
    component="dl"
    sx={{
      m: 0,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: "8px 16px",
      fontSize: "0.875rem",
      "& dt": { color: "text.secondary" },
      "& dd": {
        m: 0,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        overflowWrap: "anywhere",
      },
    }}
  >
    {rows.map(([label, value]) => (
      <Box key={label} sx={{ display: "contents" }}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </Box>
    ))}
  </Box>
);
