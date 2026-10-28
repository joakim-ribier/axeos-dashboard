import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { LocalNotification } from "@/utils/minerNotifications";

import {
  NotificationsProvider,
  useNotifications,
} from "./NotificationsContext";

const makeNotification = (id: string): LocalNotification => ({
  id,
  timestamp: Date.now(),
  type: "autoRefreshToggled",
  detail: "on",
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

describe("NotificationsContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty when localStorage has nothing stored", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.notifications).toEqual([]);
  });

  it("loads previously persisted notifications on mount", () => {
    window.localStorage.setItem(
      "axeos.notifications",
      JSON.stringify([makeNotification("a")]),
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe("a");
  });

  it("prepends new notifications (most recent first)", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => result.current.addNotifications([makeNotification("first")]));
    act(() => result.current.addNotifications([makeNotification("second")]));

    expect(result.current.notifications.map((n) => n.id)).toEqual([
      "second",
      "first",
    ]);
  });

  it("caps the list at 100 entries", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

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
      wrapper,
    });
    act(() => result.current.addNotifications([makeNotification("kept")]));
    unmount();

    const { result: remounted } = renderHook(() => useNotifications(), {
      wrapper,
    });

    expect(remounted.current.notifications.map((n) => n.id)).toContain("kept");
  });

  it("clears all notifications, and hides everything up to the given time", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.clearedAt).toBe(0);

    act(() => result.current.addNotifications([makeNotification("a")]));
    act(() => result.current.clear(2_000));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.clearedAt).toBe(2_000);
  });

  it("never moves clearedAt back, and keeps it across a remount", () => {
    const { result, unmount } = renderHook(() => useNotifications(), {
      wrapper,
    });
    act(() => result.current.clear(2_000));
    act(() => result.current.clear(1_000));
    expect(result.current.clearedAt).toBe(2_000);
    unmount();

    const { result: remounted } = renderHook(() => useNotifications(), {
      wrapper,
    });
    expect(remounted.current.clearedAt).toBe(2_000);
  });

  it("throws when used outside a provider", () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      /must be used within NotificationsProvider/,
    );
  });
});
