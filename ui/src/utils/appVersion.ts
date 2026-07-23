// src/utils/appVersion.ts
import type { AppVersionStatus } from "@/hooks/useMiners";

export type { AppVersionStatus };

/**
 * Whether the dashboard app's own "update available" notification should
 * fire, given the previously-known status and the just-fetched one. Only
 * fires on the transition INTO "updateAvailable" -- not on every 90s poll
 * while it stays that way, and not on the (equally uneventful) recovery to
 * "upToDate", which the persistent Sidebar icon already covers without
 * needing a one-shot notification too.
 *
 * The actual GitHub check happens server-side (see internal/appversion in
 * the Go backend, checked at most once a day) -- this is just the client's
 * "have I already told this browser about it" transition logic, same
 * pattern as every other notification in minerNotifications.ts.
 */
export const shouldNotifyForAppUpdate = (
  previousStatus: AppVersionStatus | undefined,
  currentStatus: AppVersionStatus,
): boolean =>
  currentStatus === "updateAvailable" && previousStatus !== "updateAvailable";
