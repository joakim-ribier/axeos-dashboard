// src/components/layout/ServicesStatus.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MemoryIcon from "@mui/icons-material/Memory";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import SyncIcon from "@mui/icons-material/Sync";
import {
  alpha,
  Box,
  ButtonBase,
  Chip,
  Popover,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";

import {
  type ServiceKey,
  type ServicesStatus,
  type ServiceState,
  useServicesStatus,
} from "@/hooks/useServicesStatus";
import { formatTimestamp, parseGoDuration } from "@/utils/format";

// An interval in its own round unit: "2 min", "15 s", "24 h".
const shortInterval = (goDuration: string) => {
  const ms = parseGoDuration(goDuration);
  if (ms >= 3_600_000 && ms % 3_600_000 === 0)
    return { count: ms / 3_600_000, unit: "h" };
  if (ms >= 60_000 && ms % 60_000 === 0)
    return { count: ms / 60_000, unit: "min" };
  return { count: Math.round(ms / 1000), unit: "s" };
};

type PaletteKey = "success" | "warning" | "error";

// unknown has no palette color of its own: greyed out.
const STATE_PALETTE: Record<ServiceState, PaletteKey | null> = {
  ok: "success",
  late: "warning",
  offline: "error",
  unknown: null,
};

// The worst state wins the summary.
const SEVERITY: Record<ServiceState, number> = {
  ok: 0,
  unknown: 1,
  late: 2,
  offline: 3,
};

const SERVICES: { key: ServiceKey; icon: typeof SyncIcon }[] = [
  { key: "dashboardApi", icon: DashboardIcon },
  { key: "feeder", icon: SyncIcon },
  { key: "healthCheck", icon: MonitorHeartIcon },
  { key: "mailer", icon: MailOutlineIcon },
  { key: "firmwareCache", icon: MemoryIcon },
];

const worstState = (data: ServicesStatus): ServiceState =>
  SERVICES.map(({ key }) => data.services[key].state).reduce(
    (a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a),
    "ok" as ServiceState,
  );

// The platform at a glance: red when a service doesn't answer, orange when
// one missed a run, green otherwise -- a run still to come included.
const platformState = (data: ServicesStatus): ServiceState => {
  const worst = worstState(data);
  return worst === "offline" || worst === "late" ? worst : "ok";
};

const useStateColor = () => {
  const theme = useTheme();
  return (state: ServiceState) => {
    const key = STATE_PALETTE[state];
    return key ? theme.palette[key].main : theme.palette.text.disabled;
  };
};

const Dot = ({ state }: { state: ServiceState }) => {
  const color = useStateColor()(state);
  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: color,
        // A soft halo while something's wrong -- the eye finds it.
        boxShadow: state === "ok" ? "none" : `0 0 0 3px ${alpha(color, 0.25)}`,
      }}
    />
  );
};

/** One service in the window: its icon tinted by its state, its name and
 * state, and what it last did. */
const ServiceRow = ({
  icon: Icon,
  name,
  state,
  detail,
}: {
  icon: typeof SyncIcon;
  name: string;
  state: ServiceState;
  detail: string[];
}) => {
  const { t } = useTranslation();
  const color = useStateColor()(state);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          bgcolor: alpha(color, 0.12),
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          {name}
        </Typography>
        {detail.map((line) => (
          <Typography
            key={line}
            variant="caption"
            color="text.secondary"
            component="div"
          >
            {line}
          </Typography>
        ))}
      </Box>
      <Chip
        size="small"
        label={t(`servicesStatus.states.${state}`)}
        sx={{
          height: 22,
          fontSize: "0.72rem",
          fontWeight: 600,
          color,
          bgcolor: alpha(color, 0.12),
        }}
      />
    </Box>
  );
};

/** The window a click on "State" opens: every service, how it's doing. */
const StatusCard = ({ data }: { data: ServicesStatus }) => {
  const { t } = useTranslation();
  // "every minute" for one, "every 2 min" otherwise.
  const every = (goDuration: string) => {
    const { count, unit } = shortInterval(goDuration);
    return count === 1
      ? t(`servicesStatus.everyOne.${unit}`)
      : t("servicesStatus.every", { interval: `${count} ${unit}` });
  };

  const detail = (key: ServiceKey): string[] => {
    const s = data.services[key];
    if (key === "dashboardApi") {
      return [
        t("servicesStatus.startedAt", { date: formatTimestamp(s.startedAt) }),
        t("servicesStatus.version", { version: s.version ?? "?" }),
      ];
    }
    return [
      ...(s.interval ? [every(s.interval)] : []),
      s.lastRunAt
        ? t("servicesStatus.lastRun", { date: formatTimestamp(s.lastRunAt) })
        : t("servicesStatus.noRunYet"),
    ];
  };

  return (
    <Box sx={{ width: 440, maxWidth: "calc(100vw - 32px)" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Dot state={platformState(data)} />
        <Typography variant="subtitle2" fontWeight={700}>
          {t("servicesStatus.title")}
        </Typography>
      </Box>
      <Stack
        sx={{
          px: 2,
          py: 0.5,
          "& > * + *": { borderTop: 1, borderColor: "divider" },
        }}
      >
        {SERVICES.map(({ key, icon }) => (
          <ServiceRow
            key={key}
            icon={icon}
            name={t(`servicesStatus.services.${key}`)}
            state={data.services[key].state}
            detail={detail(key)}
          />
        ))}
      </Stack>
      <Typography
        variant="caption"
        color="text.disabled"
        component="div"
        sx={{ px: 2, pb: 1.5, pt: 0.5 }}
      >
        {t("servicesStatus.checkedAt", {
          date: formatTimestamp(data.checkedAt),
        })}
      </Typography>
    </Box>
  );
};

/**
 * Under the auto-refresh switch, a small card tinted by how this
 * dashboard's processes are doing (the worst wins) -- a click opens every
 * service's details. Folded rail: its icon alone, tinted the same.
 */
export const ServicesStatusBlock = ({ collapsed }: { collapsed: boolean }) => {
  const { t } = useTranslation();
  const { data, refetch } = useServicesStatus();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const stateColor = useStateColor();
  if (!data) return null;

  // The color says it all; the window says which and why.
  const platform = platformState(data);
  const color = stateColor(platform);
  const label = `${t("servicesStatus.label")} — ${t(`servicesStatus.summary.${platform}`)}`;

  return (
    <>
      <Tooltip title={collapsed ? label : ""} arrow placement="right">
        <ButtonBase
          onClick={(e) => {
            setAnchor(e.currentTarget);
            // Opened to be read: asked again, whatever the auto-refresh says.
            void refetch();
          }}
          aria-label={label}
          sx={{
            mx: collapsed ? "auto" : 2,
            my: 0.75,
            borderRadius: 2,
            border: 1,
            borderColor: alpha(color, 0.35),
            bgcolor: alpha(color, 0.08),
            transition: "background-color 0.15s ease",
            "&:hover": { bgcolor: alpha(color, 0.16) },
            ...(collapsed
              ? { width: 36, height: 36 }
              : {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 1.25,
                  px: 1.5,
                  py: 1,
                  textAlign: "left",
                }),
          }}
        >
          <MonitorHeartIcon sx={{ fontSize: 18, color }} />
          {!collapsed && (
            <>
              <Typography variant="body2" fontWeight={600}>
                {t("servicesStatus.label")}
              </Typography>
              <Box sx={{ ml: "auto" }}>
                <Dot state={platform} />
              </Box>
            </>
          )}
        </ButtonBase>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{
          paper: { sx: { borderRadius: 3, ml: 1, overflow: "hidden" } },
        }}
      >
        <StatusCard data={data} />
      </Popover>
    </>
  );
};
