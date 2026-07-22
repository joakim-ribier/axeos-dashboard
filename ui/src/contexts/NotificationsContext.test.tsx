import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { MinerNotification } from "@/utils/minerNotifications";

import {
  NotificationsProvider,
  useNotifications,
} from "./NotificationsContext";

const STORAGE_KEY = "axeos.notifications";

const makeNotification = (id: string): MinerNotification => ({
  id,
  timestamp: Date.now(),
  minerLabel: "bitaxe-office",
  type: "temp",
  detail: "65",
});

describe("NotificationsContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty when localStorage has nothing stored", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });

    expect(result.current.notifications).toEqual([]);
  });

  it("loads previously persisted notifications on mount", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([makeNotification("a")]),
    );

    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe("a");
  });

  it("prepends new notifications (most recent first)", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
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
      wrapper: NotificationsProvider,
    });

    for (let i = 0; i < 102; i++) {
      act(() => result.current.addNotifications([makeNotification(`n${i}`)]));
    }

    expect(result.current.notifications).toHaveLength(100);
    // the 2 oldest (n0, n1) should have been dropped
    expect(result.current.notifications.map((n) => n.id)).not.toContain("n0");
    expect(result.current.notifications.map((n) => n.id)).not.toContain("n1");
  });

  it("persists to localStorage so a remount picks the list back up", () => {
    const { result, unmount } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });

    act(() => result.current.addNotifications([makeNotification("kept")]));
    unmount();

    const { result: remounted } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
    });
    expect(remounted.current.notifications.map((n) => n.id)).toContain("kept");
  });

  it("clears all notifications", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationsProvider,
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
