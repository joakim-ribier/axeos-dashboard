// src/components/Header.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Header: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const toolbarSx = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "center",
    gap: isMobile ? 1 : 0,
    py: isMobile ? 1 : 0,
  };

  const titleSx = {
    flexGrow: 1,
    textAlign: "center",
    width: isMobile ? "100%" : "auto",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const controlsSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    alignSelf: isMobile ? "flex-end" : "auto",
    marginLeft: isMobile ? undefined : "auto",
  };

  return (
    <AppBar position="fixed" color="primary" elevation={2}>
      <Toolbar sx={toolbarSx}>
        <Typography variant="h6" component="h1" noWrap sx={titleSx}>
          {t("title")}
        </Typography>

        <Box sx={controlsSx}>
          <LanguageSwitcher />
        </Box>
      </Toolbar>
    </AppBar>
  );
};
