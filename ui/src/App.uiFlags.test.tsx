// Every page ui.page.* controls, in every state, on both ends: its Sidebar
// entry and its route. "enabled" and "readonly" both keep the page (what
// "readonly" changes inside it is tested next to that page); "hidden"
// removes the entry and lands the route on the home page without ever
// loading the page's own data.
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import type { UIFeatures, UIVisibility } from "@/types/uiFeatures";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

type Page = keyof UIFeatures["page"];

const PAGES: {
  page: Page;
  path: string;
  navLabel: string;
  /** A request only this page makes -- proof it actually rendered. */
  ownRequest: string;
}[] = [
  {
    page: "settings",
    path: "/settings/miners",
    navLabel: "Settings",
    ownRequest: "/api/config/settings",
  },
  {
    page: "backups",
    path: "/backups",
    navLabel: "Backups",
    ownRequest: "/api/backups",
  },
  {
    page: "audit",
    path: "/audit",
    navLabel: "Audit",
    ownRequest: "/api/audit",
  },
];

const STATES: UIVisibility[] = ["enabled", "readonly", "hidden"];

const mockBackend = (page: Page, state: UIVisibility) => {
  mockedAxios.get.mockReset();
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === "/api/info") {
      return Promise.resolve({
        data: {
          remote: false,
          ui: {
            page: {
              settings: "enabled",
              backups: "enabled",
              audit: "enabled",
              [page]: state,
            },
            action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
          },
        },
      });
    }
    if (url === "/api/config/miners") {
      return Promise.resolve({
        data: {
          bitaxes: [
            {
              ip: "192.168.1.10",
              hostname: "bitaxe-1",
              mac: "aa:bb:cc:dd:ee:01",
              model: "bitaxe",
              enabled: true,
              url: "pool.example.com",
              port: 3333,
              user: "wallet.worker",
              fallbackUrl: "",
              fallbackPort: 0,
              fallbackUser: "",
            },
          ],
        },
      });
    }
    if (url === "/api/miners") {
      return Promise.resolve({ data: { configured: 1, total: 0, miners: [] } });
    }
    return Promise.reject(new Error(`not mocked: ${url}`));
  });
};

const requested = (url: string) =>
  mockedAxios.get.mock.calls.some(([called]) => called === url);

const navLinks = (label: string) =>
  screen.queryAllByRole("link", { name: label });

describe.each(PAGES)(
  "the $page page",
  ({ page, path, navLabel, ownRequest }) => {
    describe.each(STATES)("when ui.page.%s", (state) => {
      const kept = state !== "hidden";

      it(kept ? "has its Sidebar entry" : "has no Sidebar entry", async () => {
        mockBackend(page, state);
        render(
          <MemoryRouter initialEntries={["/"]}>
            <App />
          </MemoryRouter>,
        );

        // The Sidebar's Home entry renders before /api/info answers; the
        // page entries follow that answer.
        await waitFor(() => expect(requested("/api/info")).toBe(true));
        await waitFor(() => expect(navLinks("Home").length).toBeGreaterThan(0));
        if (kept) {
          await waitFor(() =>
            expect(navLinks(navLabel).length).toBeGreaterThan(0),
          );
        } else {
          await waitFor(() => expect(requested("/api/miners")).toBe(true));
          expect(navLinks(navLabel)).toHaveLength(0);
        }
      });

      it(
        kept ? "opens on its route" : "sends its route to the home page",
        async () => {
          mockBackend(page, state);
          render(
            <MemoryRouter initialEntries={[path]}>
              <App />
            </MemoryRouter>,
          );

          if (kept) {
            await waitFor(() => expect(requested(ownRequest)).toBe(true));
          } else {
            await waitFor(() => expect(requested("/api/miners")).toBe(true));
            expect(requested(ownRequest)).toBe(false);
          }
        },
      );
    });
  },
);
