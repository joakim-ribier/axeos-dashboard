// src/components/ui/ConfirmDialog.tsx
import { useTranslation } from "react-i18next";
import { Box, Dialog, Divider, Typography } from "@mui/material";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  actionLabel?: string;
  actionColor?:
    "primary" | "secondary" | "error" | "warning" | "info" | "success";
}

const COLOR_MAP: Record<string, string> = {
  primary: "#00b4ff",
  info: "#00b4ff",
  warning: "#ffa726",
  error: "#f44336",
  success: "#66bb6a",
  secondary: "#ab47bc",
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  actionLabel,
  actionColor = "info",
}: ConfirmDialogProps) => {
  const { t } = useTranslation();
  const color = COLOR_MAP[actionColor] ?? COLOR_MAP.info;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-dialog-title"
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
          },
        },
      }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
        <Typography
          id="confirm-dialog-title"
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: description ? 1 : 0 }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.6 }}
          >
            {description}
          </Typography>
        )}
      </Box>

      <Divider sx={{ mx: 2.5 }} />

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          px: 2.5,
          py: 1.5,
        }}
      >
        {/* Cancel */}
        <Box
          onClick={onClose}
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1.5,
            py: 0.6,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            color: "text.secondary",
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.15s ease",
            "&:hover": { borderColor: "text.secondary", color: "text.primary" },
          }}
        >
          <Typography variant="caption" sx={{ fontSize: "0.75rem" }}>
            {t("dialog.actions.cancel.label")}
          </Typography>
        </Box>

        {/* Confirm */}
        <Box
          onClick={onConfirm}
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1.5,
            py: 0.6,
            borderRadius: 1,
            border: "1px solid",
            borderColor: color,
            backgroundColor: `${color}18`,
            color: color,
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.15s ease",
            "&:hover": { backgroundColor: `${color}28` },
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontSize: "0.75rem", fontWeight: 600 }}
          >
            {actionLabel || t("dialog.actions.confirm.label")}
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
};
