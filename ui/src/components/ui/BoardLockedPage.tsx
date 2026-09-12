// src/components/ui/BoardLockedPage.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import axios from "axios";

import { GradientBar } from "./PageHeader/GradientBar";

interface BoardLockedPageProps {
  boardId: string;
  // Base URL of the hashboard instance backing this board (server-side
  // config.HashboardURL, echoed on the 403 response — see useMiners.ts's
  // ApiError). null means the server isn't configured for this yet.
  hashboardUrl: string | null;
}

export const BoardLockedPage = ({
  boardId,
  hashboardUrl,
}: BoardLockedPageProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hashboardUrl) return;
    setSubmitting(true);
    try {
      await axios.post(`${hashboardUrl}/api/boards/${boardId}/request-access`, {
        email: email.trim(),
      });
    } catch (err) {
      // Show the same generic "sent" state regardless of outcome — a
      // network failure here shouldn't read any differently to the visitor
      // than hashboard's own anti-enumeration response would. Logged (not
      // surfaced) so a misconfigured hashboardURL is still debuggable.
      console.error("request-access failed", err);
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

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
            bgcolor: "rgba(255,167,38,0.12)",
          }}
        >
          <LockOutlineIcon sx={{ fontSize: 44, color: "warning.main" }} />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            {t("boardLocked.title")}
          </Typography>
          <Box sx={{ width: 48, my: 1.25 }}>
            <GradientBar
              height={4}
              colors={[theme.palette.warning.main, theme.palette.warning.dark]}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("boardLocked.message")}
          </Typography>
        </Box>

        {sent ? (
          <Alert severity="success" sx={{ width: "100%" }}>
            {t("boardLocked.sent")}
          </Alert>
        ) : (
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              width: "100%",
            }}
          >
            <TextField
              type="email"
              required
              fullWidth
              label={t("boardLocked.emailLabel")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting || !email.trim() || !hashboardUrl}
            >
              {submitting ? t("boardLocked.sending") : t("boardLocked.submit")}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
