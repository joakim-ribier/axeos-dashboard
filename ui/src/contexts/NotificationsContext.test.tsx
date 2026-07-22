import { MemoryRouter } from "react-router-dom";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { MinerNotification } from "@/utils/minerNotifications";

import {
  NotificationsProvider,
  useNotifications,
} from "./NotificationsContext";

const makeNotification = (id: string): MinerNotification => ({
  id,
  timestamp: Date.now(),
  minerLabel: "bitaxe-office",
  type: "temp",
  detail: "65",
});

function wrapperFor(initialEntry: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <NotificationsProvider>{children}</NotificationsProvider>
      </MemoryRouter>
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

  it("loads previously persisted notifications on mount (a remote board)", () => {
    window.localStorage.setItem(
      "axeos.notifications.demo",
      JSON.stringify([makeNotification("b")]),
    );

    const { result } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/demo"),
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe("b");
  });

  it("keeps each board's notifications separate", () => {
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
    expect(boardA.current.notifications.map((n) => n.id)).toEqual([
      "boardA-one",
    ]);
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

  it("persists to localStorage under a board-scoped key so a remount picks the list back up", () => {
    const { result, unmount } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });

    act(() => result.current.addNotifications([makeNotification("kept")]));
    unmount();

    expect(
      window.localStorage.getItem("axeos.notifications.boardA"),
    ).not.toBeNull();

    const { result: remounted } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });
    expect(remounted.current.notifications.map((n) => n.id)).toContain("kept");
  });

  it("does not leak notifications added on one board into another board's key", () => {
    const { result: boardA } = renderHook(() => useNotifications(), {
      wrapper: wrapperFor("/boardA"),
    });
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
});
