// src/components/ui/OopsPage.tsx
import { useTranslation } from "react-i18next";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, Button, Typography } from "@mui/material";

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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 3,
        textAlign: "center",
        px: 2,
      }}
    >
      <ErrorOutlineIcon
        sx={{ fontSize: 72, color: "error.main", opacity: 0.8 }}
      />
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t(titleKey)}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 420 }}
        >
          {t(messageKey)}
        </Typography>
      </Box>
      {onRetry && (
        <Button variant="outlined" color="primary" onClick={onRetry}>
          {t("oops.retry")}
        </Button>
      )}
    </Box>
  );
};
