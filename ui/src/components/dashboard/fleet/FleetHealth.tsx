import { useState } from "react";
import { useTranslation } from "react-i18next";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Box,
  ButtonBase,
  ListItemButton,
  Popover,
  Typography,
} from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";
import { type MinerStatus, STATUS_COLOR, urgency } from "@/utils/minerStatus";

interface FleetHealthProps {
  miners: Miner[];
  statusOf: (miner: Miner) => MinerStatus;
  onOpen: (ip: string) => void;
}

/** "5/5 OK" at a glance, in the color of the most urgent problem if any.
 * Unfolds into every miner, the problems first -- each opens its panel. */
export const FleetHealth = ({ miners, statusOf, onOpen }: FleetHealthProps) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const rank = (m: Miner) => urgency(statusOf(m));
  const sorted = [...miners].sort((a, b) => rank(a) - rank(b));
  const problems = sorted.filter((m) => statusOf(m) !== "ok");
  const color = STATUS_COLOR[problems.length ? statusOf(problems[0]) : "ok"];
  const Icon = problems.length ? WarningAmberIcon : CheckCircleOutlineIcon;

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup
        aria-expanded={Boolean(anchor)}
        sx={{
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          border: 1,
          borderColor: color,
          color,
          fontSize: "0.75rem",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <Icon sx={{ fontSize: 14 }} />
        {t("dashboard.health.ok", {
          ok: miners.length - problems.length,
          total: miners.length,
        })}
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            transition: "transform 0.2s",
            transform: anchor ? "rotate(180deg)" : "none",
          }}
        />
      </ButtonBase>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width: 320,
              maxWidth: "calc(100vw - 32px)",
              border: 1,
              borderColor: "divider",
              backgroundImage: "none",
              bgcolor: "background.paper",
            },
          },
        }}
      >
        {sorted.map((m) => {
          const status = statusOf(m);
          return (
            <ListItemButton
              key={m.macAddr || m.ip}
              onClick={() => {
                setAnchor(null);
                onOpen(m.ip);
              }}
              sx={{
                gap: 1.5,
                py: 1,
                "& + &": { borderTop: 1, borderColor: "divider" },
              }}
            >
              <Box
                sx={{
                  alignSelf: "stretch",
                  width: 3,
                  borderRadius: 1,
                  bgcolor: STATUS_COLOR[status],
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {displayName(m) ?? m.ip}
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  component="div"
                  sx={{ color: "text.secondary", fontFamily: "monospace" }}
                >
                  {[m.ip, m.deviceModel].filter(Boolean).join(" · ")}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{ color: STATUS_COLOR[status], fontWeight: 600 }}
              >
                {t(`dashboard.status.${status}`)}
              </Typography>
              <ChevronRightIcon
                fontSize="small"
                sx={{ color: "text.secondary", ml: -0.5 }}
              />
            </ListItemButton>
          );
        })}
      </Popover>
    </>
  );
};
