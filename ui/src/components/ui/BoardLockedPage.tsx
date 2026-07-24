// src/components/ui/BoardLockedPage.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import axios from "axios";

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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 3,
        textAlign: "center",
        px: 2,
      }}
    >
      <LockOutlineIcon
        sx={{ fontSize: 72, color: "warning.main", opacity: 0.8 }}
      />
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t("boardLocked.title")}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 420 }}
        >
          {t("boardLocked.message")}
        </Typography>
      </Box>

      {sent ? (
        <Alert severity="success" sx={{ maxWidth: 420 }}>
          {t("boardLocked.sent")}
        </Alert>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", gap: 1, width: "100%", maxWidth: 420 }}
        >
          <TextField
            type="email"
            required
            fullWidth
            size="small"
            label={t("boardLocked.emailLabel")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !email.trim() || !hashboardUrl}
          >
            {submitting ? t("boardLocked.sending") : t("boardLocked.submit")}
          </Button>
        </Box>
      )}
    </Box>
  );
};
