// src/pages/settings/Settings.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";
import BoltIcon from "@mui/icons-material/Bolt";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SettingsIcon from "@mui/icons-material/Settings";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import WifiFindIcon from "@mui/icons-material/WifiFind";
import {
  Alert,
  Box,
  Collapse,
  List,
  ListItemButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { PageHeader } from "@/components/ui/PageHeader";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useMiners, useUiFeatures } from "@/hooks/useMiners";
import { useMinersConfig } from "@/hooks/useMinersConfig";
import { normalizeMac } from "@/schemas/minerConfigSchema";
import { formatTimestamp } from "@/utils/format";
import { poolMismatches } from "@/utils/poolDrift";

import { ElectricitySettings } from "./ElectricitySettings";
import { latestTimestamp } from "./lastRun";
import { MinersSettings } from "./MinersSettings";
import { NotificationsSettings } from "./NotificationsSettings";
import { RemoteSettings } from "./RemoteSettings";
import { SystemSettings } from "./SystemSettings";

const SECTIONS = {
  miners: { icon: WifiFindIcon, Component: MinersSettings },
  electricity: { icon: BoltIcon, Component: ElectricitySettings },
  notifications: { icon: MailOutlineIcon, Component: NotificationsSettings },
  remote: { icon: CloudUploadIcon, Component: RemoteSettings },
  system: { icon: SettingsSuggestIcon, Component: SystemSettings },
} as const;
type SectionKey = keyof typeof SECTIONS;

// Sections with nothing to show read-only: a board never receives the push
// credentials nor the mail settings.
const EDIT_ONLY: SectionKey[] = ["notifications", "remote"];

interface SectionSummary {
  /** Left out when there's nothing worth a glance. */
  summary?: string;
  /** Something that needs a look -- an orange dot on the card, the text
   * itself only on hover so the card stays compact. */
  issue?: string;
}

/** What each card says about its section, from the data the sections
 * themselves load (shared React Query cache, no extra request). */
const useSectionSummaries = (): Record<SectionKey, SectionSummary> => {
  const { t, i18n } = useTranslation();
  const { data: configured } = useMinersConfig();
  const { data: liveMiners } = useMiners();
  const { data: settings } = useAppSettings();

  const liveByMac = new Map(
    (liveMiners ?? []).map((m) => [normalizeMac(m.macAddr), m]),
  );
  const miners = configured ?? [];
  const driftCount = miners.filter(
    (m) => poolMismatches(m, liveByMac.get(normalizeMac(m.mac))).length > 0,
  ).length;

  const notif = settings?.notifications;

  return {
    miners: {
      summary: t("settingsPage.toc.miners.summary", {
        count: miners.length,
        enabled: miners.filter((m) => m.enabled).length,
      }),
      issue:
        configured && miners.length === 0
          ? t("settingsPage.toc.miners.empty")
          : driftCount > 0
            ? t("settingsPage.toc.miners.poolDrift", { count: driftCount })
            : undefined,
    },
    electricity: {
      summary: t("settingsPage.toc.electricity.summary", {
        rate: (settings?.electricity.ratePerKwh ?? 0).toLocaleString(
          i18n.language,
        ),
        count: settings?.electricity.devices?.length ?? 0,
      }),
    },
    notifications: {
      summary: notif?.mail.smtp.host
        ? t("settingsPage.toc.notifications.summary", {
            host: notif.mail.smtp.host,
            count: notif.mail.to.length,
          })
        : t("settingsPage.toc.notifications.off"),
      issue:
        notif?.mail.smtp.host && notif.mail.to.length === 0
          ? t("settingsPage.toc.notifications.noRecipient")
          : notif?.auditReport.enabled &&
              settings?.readOnly.auditReport.lastError
            ? t("settingsPage.toc.notifications.reportFailed")
            : notif?.alerts.mail && settings?.readOnly.alertsMail.lastError
              ? t("settingsPage.toc.notifications.alertsMailFailed")
              : undefined,
    },
    // What it holds, once there's a push to set up.
    remote: {
      summary: settings?.remote.pushURL
        ? t("settingsPage.toc.remote.summary")
        : t("settingsPage.toc.remote.off"),
    },
    // What it holds, for someone looking for it.
    system: { summary: t("settingsPage.toc.system.summary") },
  };
};

const IssueDot = ({ issue }: { issue: string }) => (
  <Tooltip title={issue}>
    <Box
      role="img"
      aria-label={issue}
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: "warning.main",
        ml: "auto",
      }}
    />
  </Tooltip>
);

/** Every section with its summary and dot -- folded under a bar on a
 * phone, a sticky column next to the open section everywhere else. */
const SectionList = ({
  keys,
  current,
  summaries,
  onSelect,
}: {
  keys: SectionKey[];
  current: SectionKey;
  summaries: Record<SectionKey, SectionSummary>;
  onSelect?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <List disablePadding>
      {keys.map((k) => {
        const Icon = SECTIONS[k].icon;
        const { summary, issue } = summaries[k];
        const selected = k === current;
        return (
          <ListItemButton
            key={k}
            component={RouterLink}
            to={`../${k}`}
            relative="path"
            selected={selected}
            aria-current={selected ? "page" : undefined}
            onClick={onSelect}
            sx={{
              gap: 1.25,
              py: 1.25,
              "& + &": { borderTop: 1, borderColor: "divider" },
              "&.Mui-selected": {
                bgcolor: "rgba(0,180,255,0.12)",
                "&:hover": { bgcolor: "rgba(0,180,255,0.16)" },
              },
            }}
          >
            <Icon
              fontSize="small"
              sx={{ color: selected ? "primary.main" : "text.secondary" }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                color={selected ? "primary.main" : "text.primary"}
              >
                {t(`settingsPage.toc.${k}.title`)}
              </Typography>
              {summary && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  component="div"
                >
                  {summary}
                </Typography>
              )}
            </Box>
            {issue && <IssueDot issue={issue} />}
          </ListItemButton>
        );
      })}
    </List>
  );
};

/** The phone version: a bar naming the open section, which unfolds the
 * full list. Its own dot flags a problem in another section, so it can't go
 * unnoticed while folded. */
const SectionPicker = ({
  keys,
  current,
  summaries,
  footer,
}: {
  keys: SectionKey[];
  current: SectionKey;
  summaries: Record<SectionKey, SectionSummary>;
  footer: React.ReactNode;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const CurrentIcon = SECTIONS[current].icon;
  const otherIssues = keys
    .filter((k) => k !== current)
    .map((k) => summaries[k].issue)
    .filter((issue): issue is string => Boolean(issue));

  return (
    <Paper
      component="nav"
      variant="outlined"
      sx={{ borderRadius: 3, overflow: "hidden" }}
    >
      <ListItemButton
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ gap: 1, py: 1.25 }}
      >
        <CurrentIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {t(`settingsPage.toc.${current}.title`)}
          </Typography>
          {summaries[current].summary && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="div"
            >
              {summaries[current].summary}
            </Typography>
          )}
        </Box>
        {!open && otherIssues.length > 0 && (
          <IssueDot issue={otherIssues.join(" · ")} />
        )}
        <KeyboardArrowDownIcon
          fontSize="small"
          sx={{
            ml: open || otherIssues.length === 0 ? "auto" : 0,
            color: "text.secondary",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </ListItemButton>
      <Collapse in={open}>
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <SectionList
            keys={keys}
            current={current}
            summaries={summaries}
            onSelect={() => setOpen(false)}
          />
          {footer}
        </Box>
      </Collapse>
    </Paper>
  );
};

/**
 * Configuration: one page, one section shown at a time, picked from a list
 * whose entries each sum up their section (and flag what needs a look) --
 * the open section lives in the URL (/settings/{section}), so it can be
 * linked to directly. The Remote section only exists where it can be
 * edited: a board never receives its push credentials, so there's nothing
 * to show read-only.
 */
export const Settings = () => {
  const { t } = useTranslation();
  const { section } = useParams<{ section: string }>();
  const { ui } = useUiFeatures();
  const readOnly = ui.page.settings === "readonly";
  const summaries = useSectionSummaries();
  const { lastUpdated: minersLastUpdated } = useMinersConfig();
  const { data: appSettings } = useAppSettings();

  // A side column doesn't fit a phone: a single foldable bar there instead.
  const isPhone = useMediaQuery(useTheme().breakpoints.down("sm"), {
    noSsr: true,
  });

  const keys = (Object.keys(SECTIONS) as SectionKey[]).filter(
    (k) => !readOnly || !EDIT_ONLY.includes(k),
  );
  const current = keys.find((k) => k === section);
  if (!current) return <Navigate to="../miners" relative="path" replace />;

  const { Component } = SECTIONS[current];

  // One date for the whole configuration (miners.yml or settings.yml,
  // whichever changed last), rather than repeated atop every section.
  const lastModified = latestTimestamp([
    minersLastUpdated,
    appSettings?.lastUpdated,
  ]);
  // The menu card's footer -- it dates the whole configuration, not any one
  // section.
  const lastModifiedLine = lastModified && (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 2,
        py: 1.25,
        borderTop: 1,
        borderColor: "divider",
        color: "text.disabled",
      }}
    >
      <ScheduleIcon sx={{ fontSize: 14 }} />
      <Typography variant="caption">
        {t("settingsPage.configured.lastUpdated", {
          date: formatTimestamp(lastModified),
        })}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PageHeader
        title={t("settingsPage.header.title")}
        description={t("settingsPage.header.description")}
        icon={<SettingsIcon />}
      />

      {readOnly && (
        <Alert severity="info">{t("settingsPage.readOnlyBanner")}</Alert>
      )}

      {isPhone ? (
        <>
          <SectionPicker
            keys={keys}
            current={current}
            summaries={summaries}
            footer={lastModifiedLine}
          />
          <Component />
        </>
      ) : (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box
            sx={{
              width: { sm: 220, md: 260 },
              flexShrink: 0,
              // Stays in view under the sticky TopBar while a long section
              // (the miners table) scrolls.
              position: "sticky",
              top: 80,
            }}
          >
            <Paper
              component="nav"
              variant="outlined"
              sx={{ borderRadius: 3, overflow: "hidden" }}
            >
              <SectionList
                keys={keys}
                current={current}
                summaries={summaries}
              />
              {lastModifiedLine}
            </Paper>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Component />
          </Box>
        </Box>
      )}
    </Box>
  );
};
