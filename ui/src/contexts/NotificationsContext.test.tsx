import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import type { MinerNotification } from "@/utils/minerNotifications";

import {
  NotificationsProvider,
  useNotifications,
} from "./NotificationsContext";

// ModeProvider itself now fetches GET /api/info (for isRemoteBackend) --
// mocked at the source, resolved as remote so boardId-scoped storage below
// behaves exactly as before this fetch existed. Every remote-mode test
// here (wrapperFor of anything but "/") waits for this to settle before
// asserting -- see the comment on wrapperFor below.
vi.mock("@/api/info", () => ({
  fetchInfo: () => Promise.resolve({ remote: true }),
}));

const makeNotification = (id: string): MinerNotification => ({
  id,
  timestamp: Date.now(),
  minerLabel: "bitaxe-office",
  type: "autoRefreshToggled",
  detail: "on",
});

// ModeProvider derives boardId via useParams(), which only populates from
// an actual matching <Route path=":boardId/*">, not just being inside a
// MemoryRouter -- mirrors how App.tsx's AppLayout route nests it for real.
function wrapperFor(initialEntry: string) {
  const mode = initialEntry === "/" ? "local" : "remote";
  const routePath = mode === "remote" ? "/:boardId/*" : "/*";
  const queryClient = new QueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path={routePath}
              element={
                <ModeProvider mode={mode}>
                  <NotificationsProvider>{children}</NotificationsProvider>
                </ModeProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe("NotificationsContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty when localStorage has nothing stored", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/"),
    });

    expect(result.current.notifications).toEqual([]);
  });

  it("loads previously persisted notifications on mount (local board)", () => {
    window.localStorage.setItem(
      "axeos.notifications.local",
      JSON.stringify([makeNotification("a")]),
    );

    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/"),
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe("a");
  });

  it("loads previously persisted notifications on mount (a remote board)", async () => {
    window.localStorage.setItem(
      "axeos.notifications.demo",
      JSON.stringify([makeNotification("b")]),
    );

    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/demo"),
    });

    // boardId only resolves to "demo" once ModeProvider's own /api/info
    // fetch confirms isRemoteBackend -- until then this reads the "local"
    // key (empty here), so wait for the real, board-scoped result.
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.notifications[0].id).toBe("b");
  });

  it("keeps each board's notifications separate", async () => {
    window.localStorage.setItem(
      "axeos.notifications.local",
      JSON.stringify([makeNotification("local-one")]),
    );
    window.localStorage.setItem(
      "axeos.notifications.boardA",
      JSON.stringify([makeNotification("boardA-one")]),
    );

    const { result: local } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/"),
    });
    const { result: boardA } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });

    expect(local.current.notifications.map((n) => n.id)).toEqual(["local-one"]);
    await waitFor(() =>
      expect(boardA.current.notifications.map((n) => n.id)).toEqual([
        "boardA-one",
      ]),
    );
  });

  it("prepends new notifications (most recent first)", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/"),
    });

    act(() => result.current.addNotifications([makeNotification("first")]));
    act(() => result.current.addNotifications([makeNotification("second")]));

    expect(result.current.notifications.map((n) => n.id)).toEqual([
      "second",
      "first",
    ]);
  });

  it("caps the list at 100 entries", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/"),
    });

    for (let i = 0; i < 102; i++) {
      act(() => result.current.addNotifications([makeNotification(`n${i}`)]));
    }

    expect(result.current.notifications).toHaveLength(100);
    // the 2 oldest (n0, n1) should have been dropped
    expect(result.current.notifications.map((n) => n.id)).not.toContain("n0");
    expect(result.current.notifications.map((n) => n.id)).not.toContain("n1");
  });

  it("persists to localStorage under a board-scoped key so a remount picks the list back up", async () => {
    const { result, unmount } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });
    // Let ModeProvider's /api/info resolve (isRemoteBackend) before writing
    // -- otherwise this would add under "local" during the brief window
    // before boardId settles to the real "boardA". The board-scoped key
    // showing up at all is the proof that boardId has settled (the persist
    // effect only ever writes under it once boardId flips away from
    // "local") -- a fixed number of flushed microtasks isn't a reliable
    // enough proxy for that.
    await waitFor(() =>
      expect(
        window.localStorage.getItem("axeos.notifications.boardA"),
      ).not.toBeNull(),
    );

    act(() => result.current.addNotifications([makeNotification("kept")]));
    unmount();

    const { result: remounted } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });
    await waitFor(() =>
      expect(remounted.current.notifications.map((n) => n.id)).toContain(
        "kept",
      ),
    );
  });

  it("does not leak notifications added on one board into another board's key", async () => {
    const { result: boardA } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });
    // Same reasoning as above: wait for boardId to have actually settled to
    // "boardA" (proven by its key showing up) before writing, otherwise this
    // would write under the transient "local" key that boardB's own
    // not-yet-resolved mount below would then pick up too.
    await waitFor(() =>
      expect(
        window.localStorage.getItem("axeos.notifications.boardA"),
      ).not.toBeNull(),
    );
    act(() => boardA.current.addNotifications([makeNotification("a-only")]));

    const { result: boardB } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardB"),
    });

    expect(boardB.current.notifications).toEqual([]);
  });

  it("clears all notifications", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/"),
    });

    act(() => result.current.addNotifications([makeNotification("a")]));
    act(() => result.current.clear());

    expect(result.current.notifications).toEqual([]);
  });

  it("throws when used outside a provider", () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      /must be used within NotificationsProvider/,
    );
  });

  describe("readIds / markRead", () => {
    it("starts with nothing marked read", () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: wrapperFor("/"),
      });
      expect(result.current.readIds.size).toBe(0);
    });

    it("marks the given ids as read", () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: wrapperFor("/"),
      });

      act(() => result.current.markRead(["a", "b"]));

      expect(result.current.readIds.has("a")).toBe(true);
      expect(result.current.readIds.has("b")).toBe(true);
      expect(result.current.readIds.has("c")).toBe(false);
    });

    it("persists read ids across a remount, scoped per board", async () => {
      const { result, unmount } = renderHook(() => useNotifications(), {
        wrapper: wrapperFor("/boardA"),
      });
      // Wait for boardId to have actually settled to "boardA" (its
      // notifications key showing up proves it, same signal as the
      // notifications-persist tests above) before marking read, otherwise
      // this would write under the transient "local" key instead.
      await waitFor(() =>
        expect(
          window.localStorage.getItem("axeos.notifications.boardA"),
        ).not.toBeNull(),
      );
      act(() => result.current.markRead(["seen"]));
      unmount();

      const { result: remounted } = renderHook(() => useNotifications(), {
        wrapper: wrapperFor("/boardA"),
      });
      await waitFor(() =>
        expect(remounted.current.readIds.has("seen")).toBe(true),
      );

      const { result: otherBoard } = renderHook(() => useNotifications(), {
        wrapper: wrapperFor("/boardB"),
      });
      expect(otherBoard.current.readIds.has("seen")).toBe(false);
    });

    it("clear() does not affect read ids", () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: wrapperFor("/"),
      });

      act(() => result.current.markRead(["a"]));
      act(() => result.current.clear());

      expect(result.current.readIds.has("a")).toBe(true);
    });
  });
});
