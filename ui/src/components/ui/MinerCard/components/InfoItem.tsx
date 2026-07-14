// src/components/ui/MinerCard/components/InfoItem.tsx
import { SvgIconComponent } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";

export const InfoItem = ({
  Icon,
  children,
  iconColor,
}: {
  Icon: SvgIconComponent;
  children: React.ReactNode;
  /** Override colour for the icon (any valid CSS colour) */
  iconColor?: string;
}) => {
  const theme = useTheme();
  const resolvedColour = iconColor ?? theme.palette.primary.main;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Icon
        sx={{
          color: resolvedColour,
          fontSize: 20,
        }}
      />
      <Typography
        variant="body2"
        component="span"
        sx={{
          flexGrow: 1,
          whiteSpace: "normal",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};
