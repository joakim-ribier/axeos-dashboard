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
import i18n from "@/i18n";

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
      if (url.endsWith("/miners/history")) {
        return Promise.resolve({ data: { buckets: [], miners: [] } });
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

  it("renders only the board's home, scoped to that board's API", async () => {
    const { container } = renderApp("/demo");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners"),
    );
    // The footer's board line links back to the board.
    await waitFor(() =>
      expect(container.querySelector('a[href="/demo"]')).not.toBeNull(),
    );
    // A board only reads its miners' stats: nothing else is fetched...
    const urls = new Set(mockedAxios.get.mock.calls.map(([url]) => url));
    expect([...urls].sort()).toEqual(
      ["/api/demo/miners", "/api/demo/miners/history", "/api/info"].sort(),
    );
    // ...and there's nowhere else to go: no sidebar nor top bar.
    expect(container.querySelector('a[href="/demo/alerts"]')).toBeNull();
    expect(container.querySelector('a[href="/demo/settings"]')).toBeNull();
    expect(container.querySelector('a[href="/alerts"]')).toBeNull();
  });

  it.each(["/demo/alerts", "/demo/settings"])(
    "lands on the board's home for a page a board doesn't have (%s)",
    async (path) => {
      renderApp(path);

      await waitFor(() =>
        expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners"),
      );
      for (const [url] of mockedAxios.get.mock.calls) {
        expect(url).not.toMatch(/alerts|config/);
      }
    },
  );

  it("always refreshes, even if auto-refresh was switched off before", async () => {
    window.localStorage.setItem("axeos.autoRefreshEnabled", "false");
    try {
      renderApp("/demo");

      await waitFor(() =>
        expect(window.localStorage.getItem("axeos.autoRefreshEnabled")).toBe(
          "true",
        ),
      );
    } finally {
      window.localStorage.removeItem("axeos.autoRefreshEnabled");
    }
  });

  it("speaks the visitor's browser language, whatever was picked before", async () => {
    await i18n.changeLanguage("fr");
    try {
      renderApp("/demo");

      await waitFor(() => expect(i18n.language).toBe(navigator.language));
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it.each(["/does-not-exist", "/does-not-exist/some-random-subpath"])(
    "leaves for hashboard's account page when the board has nothing behind it (404, %s)",
    async (path) => {
      mockedAxios.get.mockImplementation((url: string) => {
        if (url === "/api/info")
          return Promise.resolve({
            data: { remote: true, hashboardURL: "https://hashboard.live" },
          });
        const err = Object.assign(new Error("not found"), {
          response: { status: 404, data: { error: "board not found" } },
        });
        return Promise.reject(err);
      });
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      const replace = vi.fn();
      vi.stubGlobal("location", { ...window.location, replace });

      try {
        renderApp(path);

        await waitFor(() =>
          expect(replace).toHaveBeenCalledWith("https://hashboard.live/me"),
        );
        expect(
          screen.queryByText("This page does not exist."),
        ).not.toBeInTheDocument();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it.each(["/test", "/test/some-random-subpath"])(
    "shows the request-access screen for a private board (403, %s), instead of a generic 'not found'",
    async (path) => {
      mockedAxios.get.mockImplementation((url: string) => {
        if (url === "/api/info")
          return Promise.resolve({ data: { remote: true } });
        const err = Object.assign(new Error("forbidden"), {
          response: { status: 403, data: { error: "board is private" } },
        });
        return Promise.reject(err);
      });
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      renderApp(path);

      // Not the generic OopsPage, which would hide that the board does exist.
      await screen.findByRole("button", { name: "Send access link" });
      expect(
        screen.queryByText("This page does not exist."),
      ).not.toBeInTheDocument();
    },
  );

  it("still renders the local dashboard at / (unaffected by the remote branch)", async () => {
    renderApp("/");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/config/miners"),
    );
  });

  it.each(["/foobar", "/foobar/some-random-subpath"])(
    "lands on the local home for a board-shaped typo (%s) against a plain dashboard-api (remote: false)",
    async (path) => {
      const remoteMock = mockedAxios.get.getMockImplementation()!;
      mockedAxios.get.mockImplementation((url: string) =>
        url === "/api/info"
          ? Promise.resolve({ data: { remote: false } })
          : remoteMock(url),
      );
      mockedAxios.get.mockClear();

      const { container } = renderApp(path);

      await waitFor(() =>
        expect(mockedAxios.get).toHaveBeenCalledWith("/api/config/miners"),
      );
      // dashboard-api has no board concept: nothing is ever fetched for
      // "foobar", and the nav points at the plain local routes.
      expect(mockedAxios.get).not.toHaveBeenCalledWith("/api/foobar/miners");
      expect(container.querySelector('a[href="/alerts"]')).not.toBeNull();
      expect(container.querySelector('a[href="/foobar"]')).toBeNull();
      expect(screen.queryByText("foobar")).not.toBeInTheDocument();
    },
  );

  it("lands on a valid board's home for an unknown sub-path under it, instead of a dead end", async () => {
    renderApp("/demo/some-unknown-subpath");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners"),
    );
    expect(
      screen.queryByText("This page does not exist."),
    ).not.toBeInTheDocument();
  });

  it("sends a local path on remote-dashboard-api to hashboard's account page", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info")
        return Promise.resolve({
          data: { remote: true, hashboardURL: "https://hashboard.live" },
        });
      return Promise.reject(new Error(`unexpected URL ${url}`));
    });
    mockedAxios.get.mockClear();
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });

    try {
      renderApp("/alerts");

      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith("https://hashboard.live/me"),
      );
      // Nothing local is fetched (nor rendered) on the way out.
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
