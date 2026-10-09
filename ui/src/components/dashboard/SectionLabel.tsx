import AirIcon from "@mui/icons-material/Air";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DiamondOutlinedIcon from "@mui/icons-material/DiamondOutlined";
import EnergySavingsLeafOutlinedIcon from "@mui/icons-material/EnergySavingsLeafOutlined";
import EuroIcon from "@mui/icons-material/Euro";
import HistoryIcon from "@mui/icons-material/History";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SpeedIcon from "@mui/icons-material/Speed";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { Box, SvgIconProps, Typography } from "@mui/material";

/** One icon and color per kind of figure, so the same metric looks the
 * same in the fleet summary and in a miner's panel. */
const ICONS = {
  hashrate: [SpeedIcon, "success.main"],
  power: [BoltIcon, "warning.light"],
  efficiency: [EnergySavingsLeafOutlinedIcon, "success.light"],
  electricity: [EuroIcon, "error.light"],
  shares: [CheckCircleOutlineIcon, "success.main"],
  bestDiff: [DiamondOutlinedIcon, "#ce93d8"],
  temperature: [ThermostatIcon, "warning.main"],
  fan: [AirIcon, "primary.main"],
  status: [MonitorHeartOutlinedIcon, "success.light"],
  pools: [LanOutlinedIcon, "primary.main"],
  history: [ShowChartIcon, "primary.main"],
  session: [TimerOutlinedIcon, "#4dd0e1"],
  allTime: [HistoryIcon, "#ce93d8"],
  device: [MemoryOutlinedIcon, "info.light"],
} satisfies Record<string, [React.ComponentType<SvgIconProps>, string]>;

export type SectionIcon = keyof typeof ICONS;

interface SectionLabelProps {
  icon?: SectionIcon;
  children: React.ReactNode;
}

export const SectionLabel = ({ icon, children }: SectionLabelProps) => {
  const [Icon, color] = icon ? ICONS[icon] : [null, ""];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      {Icon && (
        <Box
          sx={{
            position: "relative",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            color,
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: 1,
              bgcolor: color,
              opacity: 0.15,
            },
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>
      )}
      <Typography
        variant="caption"
        component="h3"
        noWrap
        sx={{
          m: 0,
          color: "text.secondary",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: { xs: "0.04em", sm: "0.08em" },
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};
