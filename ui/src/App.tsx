// src/App.tsx
import { useMemo } from "react";
import { I18nextProvider } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { useMediaQuery, useTheme } from "@mui/material";
import { Box, CssBaseline, Toolbar } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import i18n from "@/i18n";
import { ModeProvider } from "@/contexts/ModeContext";
import { Home } from "@/pages/Home";
import { OopsPage } from "@/components/ui/OopsPage";
import { getTheme } from "@/theme";

export const App: React.FC = () => {
  const theme = useMemo(() => getTheme("dark"), []);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          <Header />

          <Toolbar />
          {isMobile && <Toolbar />}

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 2,
            }}
          >
            <Routes>
              <Route
                path="/"
                element={
                  <ModeProvider mode="local">
                    <Home />
                  </ModeProvider>
                }
              />
              <Route
                path="/:boardId"
                element={
                  <ModeProvider mode="remote">
                    <Home />
                  </ModeProvider>
                }
              />
              <Route
                path="*"
                element={
                  <OopsPage
                    titleKey="oops.notFound.title"
                    messageKey="oops.notFound.message"
                  />
                }
              />
            </Routes>
          </Box>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
