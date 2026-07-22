// src/App.tsx
import { useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { Box, CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { OopsPage } from "@/components/ui/OopsPage";
import { ModeProvider } from "@/contexts/ModeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { SearchProvider } from "@/contexts/SearchContext";
import i18n from "@/i18n";
import { Home } from "@/pages/Home";
import { getTheme } from "@/theme";

export const App: React.FC = () => {
  const theme = useMemo(() => getTheme("dark"), []);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          <NotificationsProvider>
            <SearchProvider>
              <Box sx={{ display: "flex", minHeight: "100vh" }}>
                <Sidebar
                  mobileOpen={mobileNavOpen}
                  onClose={() => setMobileNavOpen(false)}
                />

                <Box
                  sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <TopBar onMenuClick={() => setMobileNavOpen(true)} />

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
                </Box>
              </Box>
            </SearchProvider>
          </NotificationsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
