// src/pages/settings/SectionTitle.tsx
import { Box, Typography } from "@mui/material";

/** Title + one-line description heading each block of a settings section. */
export const SectionTitle = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Box sx={{ mb: 2 }}>
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mb: 0.5,
        color: "text.secondary",
      }}
    >
      {icon}
      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
        {title}
      </Typography>
    </Box>
    <Typography variant="body2" color="text.secondary">
      {description}
    </Typography>
  </Box>
);
