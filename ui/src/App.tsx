// src/App.tsx
import { useMemo } from "react";
import { I18nextProvider } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/AppLayout";
import { OopsPage } from "@/components/ui/OopsPage";
import { RequireMinersConfigured } from "@/components/ui/RequireMinersConfigured";
import { RequireSettingsEnabled } from "@/components/ui/RequireSettingsEnabled";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";
import { SearchProvider } from "@/contexts/SearchContext";
import i18n from "@/i18n";
import { Alerts } from "@/pages/Alerts";
import { Home } from "@/pages/Home";
import { Settings } from "@/pages/Settings";
import { getTheme } from "@/theme";

export const App: React.FC = () => {
  const theme = useMemo(() => getTheme("dark"), []);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          <RefreshSettingsProvider>
            <SearchProvider>
              <Routes>
                {/* Local mode: this server's own configured miners. A
                    genuinely unmatched path (e.g. an extra path segment)
                    falls through to "*" below rather than here, since none
                    of these children match it either -- see the AppLayout
                    doc comment for why mode/boardId live one level up. */}
                <Route element={<AppLayout mode="local" />}>
                  <Route
                    index
                    element={
                      <RequireMinersConfigured>
                        <Home />
                      </RequireMinersConfigured>
                    }
                  />
                  <Route
                    path="alerts"
                    element={
                      <RequireMinersConfigured>
                        <Alerts />
                      </RequireMinersConfigured>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <RequireSettingsEnabled>
                        <Settings />
                      </RequireSettingsEnabled>
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
                </Route>

                {/* Remote mode: a single unknown path segment always
                    matches here rather than falling through to the local
                    "*" above -- a dynamic segment outranks a splat in
                    react-router's route ranking. Whether :boardId is a real
                    board is a server question, not a routing one -- see
                    useAppInfo's boardNotFound. */}
                <Route path=":boardId" element={<AppLayout mode="remote" />}>
                  <Route index element={<Home />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route
                    path="settings"
                    element={
                      <RequireSettingsEnabled>
                        <Settings />
                      </RequireSettingsEnabled>
                    }
                  />
                </Route>
              </Routes>
            </SearchProvider>
          </RefreshSettingsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
