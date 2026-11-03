// src/pages/settings/MinerConfigPanel.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import BadgeIcon from "@mui/icons-material/Badge";
import BoltIcon from "@mui/icons-material/Bolt";
import CloseIcon from "@mui/icons-material/Close";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ScheduleIcon from "@mui/icons-material/Schedule";
import {
  Box,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { AlertThresholdsEditor } from "@/components/ui/AlertThresholdsEditor";
import { AliasEditor } from "@/components/ui/AliasEditor";
import { DeviceLink } from "@/components/ui/DeviceLink";
import { PoolEditor } from "@/components/ui/PoolEditor";
import { ScheduleEditor } from "@/components/ui/ScheduleEditor";
import { SECTION_GAP } from "@/components/ui/SectionLayout";
import { SectionMenu, SectionPicker } from "@/components/ui/SectionMenu";
import { type AlertSettings } from "@/schemas/appSettingsSchema";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { type Miner } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";
import { poolFieldLabel, poolMismatches } from "@/utils/poolDrift";

/** One configured miner's settings, a subject at a time -- its name, its
 * pools, its alert thresholds, its scheduled tasks -- each saved on its
 * own, picked from the same menu as Configuration's sections. Keyed by the
 * miner where it's used, so it opens on the first one. */
export const MinerConfigPanel = ({
  miner,
  liveMiner,
  common,
  saveMiners,
  readOnly,
  onClose,
}: {
  miner: MinerConfig;
  liveMiner?: Miner;
  /** Every miner's alert thresholds and margins. */
  common: AlertSettings;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("alias");
  // A column next to the open section doesn't fit a phone: the foldable
  // bar there, as on Configuration.
  const isPhone = useMediaQuery(useTheme().breakpoints.down("sm"), {
    noSsr: true,
  });
  const drift = poolMismatches(miner, liveMiner);
  const tasks = miner.schedule?.length ?? 0;
  const editor = { miner, saveMiners, readOnly };

  const items = [
    {
      key: "alias",
      icon: BadgeIcon,
      title: t("settingsPage.configured.alias.title"),
      summary: displayName(miner) || miner.hostname,
      description: t("settingsPage.configured.alias.description"),
    },
    {
      key: "pool",
      icon: BoltIcon,
      title: t("settingsPage.configured.pool.title"),
      summary: `${miner.url}:${miner.port}`,
      description: t("settingsPage.configured.pool.description"),
      issue: drift.length
        ? t("settingsPage.configured.pool.driftBadgeTooltip", {
            fields: drift.map((d) => poolFieldLabel(t, d.field)).join(", "),
          })
        : undefined,
    },
    {
      key: "alerts",
      icon: NotificationsActiveIcon,
      title: t("alertThresholds.title"),
      summary: `${miner.alerts?.tempHigh || common.tempHigh} °C · ${miner.alerts?.fanHigh || common.fanHigh} %`,
      description: t("settingsPage.configured.alertsDescription"),
    },
    {
      key: "schedule",
      icon: ScheduleIcon,
      title: t("settingsPage.configured.schedule.title"),
      summary: tasks
        ? t("settingsPage.configured.schedule.countTooltip", { count: tasks })
        : t("settingsPage.configured.schedule.empty"),
      description: t("settingsPage.configured.schedule.description"),
    },
  ];
  const menu = { items, current, onSelect: setCurrent };

  const content = (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: SECTION_GAP,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {items.find((i) => i.key === current)?.description}
      </Typography>
      {current === "alias" && <AliasEditor {...editor} />}
      {current === "pool" && <PoolEditor {...editor} liveMiner={liveMiner} />}
      {current === "alerts" && (
        <AlertThresholdsEditor
          {...editor}
          common={common}
          liveMiner={liveMiner}
        />
      )}
      {current === "schedule" && <ScheduleEditor {...editor} />}
    </Box>
  );

  return (
    <>
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            component="h2"
            noWrap
            sx={{ fontWeight: 600 }}
          >
            {displayName(miner) || miner.ip}
          </Typography>
          <Typography
            variant="body2"
            component="div"
            sx={{ mt: 0.5, color: "text.secondary" }}
          >
            <DeviceLink ip={miner.ip} />
            {` · ${miner.model}`}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label={t("dashboard.drawer.close")}
          sx={{ mt: -0.5, mr: -1 }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, p: 2.5, overflowY: "auto" }}>
        {isPhone ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <SectionPicker {...menu} />
            {content}
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2.5 }}>
            <Box sx={{ width: 230, flexShrink: 0 }}>
              <SectionMenu {...menu} />
            </Box>
            {content}
          </Box>
        )}
      </Box>
    </>
  );
};
