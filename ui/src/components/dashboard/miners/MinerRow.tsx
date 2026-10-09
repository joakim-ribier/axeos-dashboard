import { useTranslation } from "react-i18next";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, ButtonBase, Typography } from "@mui/material";
import { SxProps, Theme } from "@mui/material/styles";

import { type Miner } from "@/schemas/minerSchema";
import { type MinerStatus, STATUS_COLOR } from "@/utils/minerStatus";

import { FAN_GAUGE, MetricBar, TEMP_GAUGE } from "./MetricBar";
import { MinerIdentity } from "./MinerIdentity";
import { PoolLabel } from "./PoolLabel";
import { Sparkline } from "./Sparkline";

/** Shared by the header and every row so their columns always line up --
 * power and firmware only once there's room for them (lg). The list is
 * never shown below md: phones get tiles instead (see Home). */
export const rowGridSx: SxProps<Theme> = {
  display: "grid",
  alignItems: "center",
  columnGap: 2,
  gridTemplateColumns: {
    xs: "4px minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,1fr) 20px",
    lg: "4px minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.8fr) minmax(0,1fr) minmax(0,.8fr) 20px",
  },
  gridTemplateAreas: {
    xs: `"status identity hashrate temp fan pool chevron"`,
    lg: `"status identity hashrate temp fan power pool firmware chevron"`,
  },
};

export const wideOnly = { display: { xs: "none", lg: "block" } };

interface MinerRowProps {
  miner: Miner;
  status: MinerStatus;
  hashRateHistory?: (number | null)[];
  onOpen: (ip: string) => void;
}

export const MinerRow = ({
  miner,
  status,
  hashRateHistory,
  onOpen,
}: MinerRowProps) => {
  const { t } = useTranslation();
  // An unreachable miner still shows its last known readings, dimmed so
  // they don't pass for live ones.
  const readingsSx = { opacity: status === "offline" ? 0.45 : 1, minWidth: 0 };

  return (
    // A div rather than a <button>: the pool link inside it couldn't be
    // nested in a real button.
    <ButtonBase
      component="div"
      onClick={() => onOpen(miner.ip)}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        py: 1.25,
        pr: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: 0 },
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box sx={rowGridSx}>
        <Box
          sx={{
            gridArea: "status",
            alignSelf: "stretch",
            borderRadius: "0 2px 2px 0",
            bgcolor: STATUS_COLOR[status],
          }}
        />
        <Box sx={{ gridArea: "identity", minWidth: 0 }}>
          <MinerIdentity miner={miner} />
        </Box>
        <Box
          sx={{
            ...readingsSx,
            gridArea: "hashrate",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 40, maxWidth: 110 }}>
            {hashRateHistory && (
              <Sparkline
                values={hashRateHistory}
                color="primary.main"
                height={36}
              />
            )}
          </Box>
          <Typography
            sx={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
            noWrap
          >
            {miner.hashRateTHs.toFixed(2)}
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
            >
              {" TH/s"}
            </Typography>
          </Typography>
        </Box>
        <Box sx={{ ...readingsSx, gridArea: "temp" }}>
          <MetricBar value={miner.temp} {...TEMP_GAUGE} />
        </Box>
        <Box sx={{ ...readingsSx, gridArea: "fan" }}>
          <MetricBar value={miner.fanspeed} {...FAN_GAUGE} />
        </Box>
        <Box sx={{ ...readingsSx, ...wideOnly, gridArea: "power" }}>
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {`${miner.power.toFixed(1)} W`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {`${miner.energyJPerTh.toFixed(1)} J/TH`}
          </Typography>
        </Box>
        <Box sx={{ gridArea: "pool", minWidth: 0 }}>
          <PoolLabel miner={miner} />
        </Box>
        <Box sx={{ ...wideOnly, gridArea: "firmware", minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {miner.version}
          </Typography>
          {miner.updateAvailable && (
            <Typography variant="caption" color="primary.main" noWrap>
              {`↑ ${miner.latestVersion ?? t("miner.updateAvailable")}`}
            </Typography>
          )}
        </Box>
        <ChevronRightIcon
          fontSize="small"
          sx={{ gridArea: "chevron", color: "text.secondary" }}
        />
      </Box>
      {(status === "offline" || status === "configError") && (
        <Typography
          variant="caption"
          component="div"
          sx={{ pl: 3, pt: 0.75, color: STATUS_COLOR[status] }}
        >
          {status === "offline"
            ? t("miner.health.unreachable")
            : `${t("miner.error.macMismatch")} · ${miner.error}`}
        </Typography>
      )}
    </ButtonBase>
  );
};
