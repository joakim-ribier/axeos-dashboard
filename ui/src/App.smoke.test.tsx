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
      if (url === "/api/info") return Promise.resolve({ data: {} });
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
    expect(screen.getAllByText("demo").length).toBeGreaterThan(0);
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

  it("hides the board chrome (no crash) when the board genuinely doesn't exist (404)", async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/info") return Promise.resolve({ data: {} });
      const err = Object.assign(new Error("not found"), {
        response: { status: 404, data: { error: "board not found" } },
      });
      return Promise.reject(err);
    });
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    renderApp("/does-not-exist");

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
  });

  it("still renders the local dashboard at / (unaffected by the remote branch)", async () => {
    renderApp("/");

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/config/miners"),
    );
  });
});
