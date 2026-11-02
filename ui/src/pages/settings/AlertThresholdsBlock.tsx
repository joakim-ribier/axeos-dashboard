// src/pages/settings/AlertThresholdsBlock.tsx
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Box } from "@mui/material";

import { AlertThresholdsForm } from "@/components/ui/AlertThresholdsForm";

import { type AppSettingsFrameContext } from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

const UNSET = { tempHigh: 0, fanHigh: 0, tempMargin: 0, fanMargin: 0 };

/** The thresholds every miner follows unless it has its own (Configuration
 * › Miners), and the margins every miner's alerts end under -- a field
 * left empty is the built-in value. */
export const AlertThresholdsBlock = ({
  data,
  readOnly,
  persist,
  serverBasePayload,
}: AppSettingsFrameContext) => {
  const { t } = useTranslation();

  return (
    <Box>
      <SectionTitle
        icon={<NotificationsActiveIcon fontSize="small" />}
        title={t("alertThresholds.title")}
        description={t("settingsPage.appSettings.alerts.description")}
      />
      <AlertThresholdsForm
        saved={data?.alerts ?? UNSET}
        placeholders={data?.defaults.alerts ?? UNSET}
        withMargins
        readOnly={readOnly}
        onSave={(alerts) => persist({ ...serverBasePayload(), alerts })}
      />
    </Box>
  );
};
