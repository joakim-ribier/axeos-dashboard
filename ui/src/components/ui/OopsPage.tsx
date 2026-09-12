// src/components/ui/OopsPage.tsx
import { useTranslation } from "react-i18next";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Box, Button, Paper, Typography } from "@mui/material";

import { GradientBar } from "./PageHeader/GradientBar";

interface OopsPageProps {
  titleKey: string;
  messageKey: string;
  onRetry?: () => void;
}

export const OopsPage = ({ titleKey, messageKey, onRetry }: OopsPageProps) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
        px: 2,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: { xs: 4, sm: 6 },
          maxWidth: 440,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2.5,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,180,255,0.12)",
          }}
        >
          <SearchOffIcon sx={{ fontSize: 44, color: "primary.main" }} />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            {t(titleKey)}
          </Typography>
          <Box sx={{ width: 48, my: 1.25 }}>
            <GradientBar height={4} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t(messageKey)}
          </Typography>
        </Box>
        {onRetry && (
          <Button variant="outlined" color="primary" onClick={onRetry}>
            {t("oops.retry")}
          </Button>
        )}
      </Paper>
    </Box>
  );
};
