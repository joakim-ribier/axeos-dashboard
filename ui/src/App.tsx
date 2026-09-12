// src/App.tsx
import { useMemo } from "react";
import { I18nextProvider } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/AppLayout";
import { BoardLockedPage } from "@/components/ui/BoardLockedPage";
import { OopsPage } from "@/components/ui/OopsPage";
import { RequireMinersConfigured } from "@/components/ui/RequireMinersConfigured";
import { RequireSettingsEnabled } from "@/components/ui/RequireSettingsEnabled";
import { useMode } from "@/contexts/ModeContext";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { ApiError, useAppInfo, useMiners } from "@/hooks/useMiners";
import i18n from "@/i18n";
import { Alerts } from "@/pages/Alerts";
import { Home } from "@/pages/Home";
import { Settings } from "@/pages/Settings";
import { getTheme } from "@/theme";

/**
 * The remote branch's own catch-all (an unknown sub-path under a real
 * :boardId, e.g. "/demo/typo") -- mirrors Home/Alerts' own 403/404
 * handling exactly, rather than always showing a generic "not found"
 * regardless of why: a private board should still show its own
 * request-access page here, not a plain "page not found" that hides the
 * fact the board does exist. useMiners() shares its query with the
 * Sidebar's own board-status check (useAppInfo), so this costs no extra
 * request.
 */
const RemoteCatchAll: React.FC = () => {
  const { boardId } = useMode();
  const { hashboardUrl } = useAppInfo();
  const { error } = useMiners();

  if (error instanceof ApiError && error.status === 403 && boardId) {
    return <BoardLockedPage boardId={boardId} hashboardUrl={hashboardUrl} />;
  }

  return (
    <OopsPage
      titleKey="oops.notFound.title"
      messageKey="oops.notFound.message"
    />
  );
};

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
                {/* Local mode: this server's own configured miners --
                    exactly these three exact-depth paths, nothing else. A
                    static route always outranks the remote branch's dynamic
                    :boardId below (see AppLayout's doc comment for why
                    mode/boardId live one level up), so e.g. plain "/alerts"
                    stays local even though "alerts" could in principle be a
                    boardId too. Anything that isn't one of these three
                    exact paths -- including "/alerts/foo" -- falls to the
                    remote branch's own catch-all instead of a local one:
                    there's no such thing as a bare local 404 here, only
                    "board X wasn't found" for whatever the first path
                    segment happened to be. */}
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
                </Route>

                {/* Remote mode: any path that isn't one of the three exact
                    local ones above resolves here, :boardId capturing its
                    first segment -- including a deeper unknown sub-path
                    (its own "*" below), so the Sidebar's board chrome and
                    boardBlocked-driven nav lockout (see useAppInfo) stay
                    correct for the actual board being viewed instead of
                    silently dropping back to local chrome. Whether
                    :boardId is a real, reachable board is a server
                    question, not a routing one. */}
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
                  <Route path="*" element={<RemoteCatchAll />} />
                </Route>
              </Routes>
            </SearchProvider>
          </RefreshSettingsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
