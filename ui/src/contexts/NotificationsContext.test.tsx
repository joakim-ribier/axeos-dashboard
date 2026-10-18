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
      "axeos.notifications.local",
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

  it("clears all notifications", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

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
      const { result } = renderHook(() => useNotifications(), { wrapper });
      expect(result.current.readIds.size).toBe(0);
    });

    it("marks the given ids as read", () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => result.current.markRead(["a", "b"]));

      expect(result.current.readIds.has("a")).toBe(true);
      expect(result.current.readIds.has("b")).toBe(true);
      expect(result.current.readIds.has("c")).toBe(false);
    });

    it("persists read ids across a remount", () => {
      const { result, unmount } = renderHook(() => useNotifications(), {
        wrapper,
      });
      act(() => result.current.markRead(["seen"]));
      unmount();

      const { result: remounted } = renderHook(() => useNotifications(), {
        wrapper,
      });

      expect(remounted.current.readIds.has("seen")).toBe(true);
    });

    it("clear() does not affect read ids", () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      act(() => result.current.markRead(["a"]));
      act(() => result.current.clear());

      expect(result.current.readIds.has("a")).toBe(true);
    });
  });
});
