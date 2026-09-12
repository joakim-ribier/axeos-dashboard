// Mounts the real <App/> (rather than a hand-rolled Route mimic, like every
// other test in this codebase uses) to catch a regression in the actual
// route tree itself -- e.g. AppLayout/ModeProvider nesting, or local vs.
// remote dispatch -- that a per-hook unit test wouldn't notice since each
// of those already assumes the routing wiring around it is correct.
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routing smoke test (remote board)", () => {
  beforeEach(() => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({ data: { remote: true } });
      if (url.endsWith("/miners/alerts/history")) {
        return Promise.resolve({
          data: { episodes: [], total: 0, page: 1, pageSize: 50 },
        });
      }
      if (url.endsWith("/miners/alerts")) return Promise.resolve({ data: [] });
      if (url.endsWith("/miners")) {
        return Promise.resolve({
          data: { configured: 0, total: 0, miners: [] },
        });
      }
      if (url.endsWith("/config/settings")) {
        return Promise.resolve({
          data: { electricity: { ratePerKwh: 0 }, remote: {}, readOnly: {} },
        });
      }
      if (url.endsWith("/config/miners")) {
        return Promise.resolve({ data: { bitaxes: [] } });
      }
      return Promise.reject(new Error(`unexpected URL ${url}`));
    });
  });

  it("renders Home under a remote board, scoped to that board's API", async () => {
    renderApp("/demo");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners"),
    );
    // The board chip also waits on /api/info (isRemoteBackend), a separate
    // fetch from the miners call above -- wait for the actual DOM outcome
    // rather than assuming both have settled by now.
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThan(0),
    );
  });

  it("renders Alerts under a remote board, scoped to that board's API", async () => {
    renderApp("/demo/alerts");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/demo/miners/alerts"),
        expect.anything(),
      ),
    );
  });

  it("renders Settings under a remote board, scoped to that board's API", async () => {
    renderApp("/demo/settings");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/config/settings"),
    );
  });

  it("hides the board chrome, but keeps the sidebar usable, when the board genuinely doesn't exist (404)", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({ data: { remote: true } });
      const err = Object.assign(new Error("not found"), {
        response: { status: 404, data: { error: "board not found" } },
      });
      return Promise.reject(err);
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    const { container } = renderApp("/does-not-exist");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "/api/does-not-exist/miners",
      ),
    );
    // The bug this refactor set out to fix: no fake "board is private/public"
    // chrome for a board that plain doesn't exist. The error has to
    // propagate through react-query into a re-render first, so wait for the
    // actual DOM outcome rather than just the axios call above.
    await waitFor(() =>
      expect(
        screen.queryByLabelText("board is private"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("board is public")).not.toBeInTheDocument();

    // A plain "page not found" must never lock the sidebar -- unlike a
    // private board, there's nowhere useful this could redirect to, so
    // Home/Alerts/Settings stay real, clickable destinations.
    for (const href of [
      "/does-not-exist",
      "/does-not-exist/alerts",
      "/does-not-exist/settings",
    ]) {
      const link = container.querySelector(`a[href="${href}"]`);
      expect(link).not.toHaveAttribute("aria-disabled");
    }
  });

  it("shows the exact same 'not found' outcome on an unknown sub-path as on the board root, sidebar left usable in both", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({ data: { remote: true } });
      const err = Object.assign(new Error("not found"), {
        response: { status: 404, data: { error: "board not found" } },
      });
      return Promise.reject(err);
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    const { container } = renderApp("/does-not-exist/some-random-subpath");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "/api/does-not-exist/miners",
      ),
    );
    // Same title/message as the board-root 404 case above -- this asserts
    // the exact rendered text, not just "some OopsPage showed up", so a
    // future drift back to two different wordings would fail here.
    await screen.findByText("Page not found");
    await screen.findByText("This page does not exist.");

    for (const href of [
      "/does-not-exist",
      "/does-not-exist/alerts",
      "/does-not-exist/settings",
    ]) {
      const link = container.querySelector(`a[href="${href}"]`);
      expect(link).not.toHaveAttribute("aria-disabled");
    }
  });

  it("shows the same board-locked screen on an unknown sub-path as on a private board's root, instead of a generic 'not found'", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({ data: { remote: true } });
      const err = Object.assign(new Error("forbidden"), {
        response: { status: 403, data: { error: "board is private" } },
      });
      return Promise.reject(err);
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    renderApp("/test/some-random-subpath");

    // Same request-access form as the board-root 403 case -- not the
    // generic OopsPage, which would hide that the board does exist.
    await screen.findByRole("button", { name: "Send access link" });
    expect(
      screen.queryByText("This page does not exist."),
    ).not.toBeInTheDocument();
  });

  it("still renders the local dashboard at / (unaffected by the remote branch)", async () => {
    renderApp("/");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/config/miners"),
    );
  });

  it("never shows board chrome/lockout for a board-shaped typo against a plain dashboard-api (remote: false) -- a mistyped local URL must stay a plain 404", async () => {
    // Mirrors what dashboard-api actually does for /api/{anything}/miners:
    // no such route exists there, so chi's router itself returns a plain
    // 404 (no JSON body) -- easy to misread client-side as "board not
    // found" if the client didn't first check whether boards are even a
    // concept on this backend (see useAppInfo's isRemoteBackend).
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({ data: { remote: false } });
      const err = Object.assign(new Error("not found"), {
        response: { status: 404, data: "404 page not found" },
      });
      return Promise.reject(err);
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    const { container } = renderApp("/foobar");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/foobar/miners"),
    );
    await screen.findByText("This page does not exist.");

    // The generic OopsPage, not BoardLockedPage -- no "Send access link".
    expect(
      screen.queryByRole("button", { name: "Send access link" }),
    ).not.toBeInTheDocument();

    // And nav must stay usable -- there's no board to be blocked from.
    for (const href of ["/foobar", "/foobar/alerts", "/foobar/settings"]) {
      const link = container.querySelector(`a[href="${href}"]`);
      expect(link).not.toHaveAttribute("aria-disabled");
    }

    // No board chip either -- this isn't a board at all.
    expect(screen.queryByText("foobar")).not.toBeInTheDocument();
  });

  it("also locks the sidebar for a private board (403), not just a missing one (404)", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({ data: { remote: true } });
      const err = Object.assign(new Error("forbidden"), {
        response: { status: 403, data: { error: "board is private" } },
      });
      return Promise.reject(err);
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    const { container } = renderApp("/test");

    // BoardLockedPage renders on 403 -- its request-access form is the
    // clearest sign the error actually propagated before checking the nav.
    await screen.findByRole("button", { name: "Send access link" });

    for (const href of ["/test", "/test/alerts", "/test/settings"]) {
      const link = container.querySelector(`a[href="${href}"]`);
      expect(link).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("keeps a valid board's own sidebar/chrome for an unknown sub-path under it, instead of dropping to local", async () => {
    const { container } = renderApp("/demo/some-unknown-subpath");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners"),
    );
    // Board "demo" itself is reachable (the default mock returns 200) --
    // only this one sub-path is bogus, so unlike the 404/403 cases above,
    // the other real pages for this board must stay navigable. The Sidebar
    // mounts twice (mobile + desktop drawers), so "demo" appears twice.
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThan(0),
    );
    const homeLink = container.querySelector('a[href="/demo"]');
    expect(homeLink).not.toHaveAttribute("aria-disabled");

    // The board itself is fine -- it's specifically this sub-path that has
    // no page behind it, so the generic "not found" is the correct (and
    // only) outcome here, same as any other dead link in the app.
    await screen.findByText("This page does not exist.");
  });
});
