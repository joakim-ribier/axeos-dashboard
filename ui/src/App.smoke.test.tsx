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

  it("lands on a valid board's home for an unknown sub-path under it, instead of a dead end", async () => {
    const { container } = renderApp("/demo/some-unknown-subpath");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners"),
    );
    // The Sidebar mounts twice (mobile + desktop drawers), so "demo"
    // appears twice.
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThan(0),
    );
    const homeLink = container.querySelector('a[href="/demo"]');
    expect(homeLink).not.toHaveAttribute("aria-disabled");
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
