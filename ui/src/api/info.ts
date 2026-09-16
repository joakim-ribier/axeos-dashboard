// src/api/info.ts
import axios from "axios";

import { DEFAULT_UI_FEATURES, UIFeatures } from "@/types/uiFeatures";

// Its own module (rather than living in useMiners.ts, where the rest of
// GET /api/info's consumers are) so that ModeContext can fetch it too
// without a circular import: ModeContext -> here, and useMiners -> both
// ModeContext (for apiPaths/boardId) and here.
export type AppVersionStatus = "unknown" | "upToDate" | "updateAvailable";

export interface InfoResult {
  buildSHA?: string;
  /** Real semver ("0.1.0"), only set on a tagged-release build -- "dev"
   * (or undefined) everywhere else, including the rolling "latest" build.
   * See server/internal/version.Version. */
  appVersion?: string;
  appVersionStatus: AppVersionStatus;
  appVersionReleaseURL: string | null;
  hashboardUrl: string | null;
  ui: UIFeatures;
  // True for remote-dashboard-api, false for dashboard-api -- see
  // model.InfoResponse.Remote server-side. The only way the client can
  // tell which binary it's actually talking to, since both serve the same
  // routes and hashboardURL alone isn't reliable (remote-dashboard-api can
  // leave it unconfigured too).
  remote: boolean;
}

export const fetchInfo = async (): Promise<InfoResult> => {
  const { data } = await axios.get<{
    buildSHA?: string;
    appVersion?: string;
    appVersionStatus?: AppVersionStatus;
    appVersionReleaseURL?: string;
    hashboardURL?: string;
    ui?: UIFeatures;
    remote?: boolean;
  }>("/api/info");
  return {
    buildSHA: data.buildSHA,
    appVersion: data.appVersion,
    appVersionStatus: data.appVersionStatus ?? "unknown",
    appVersionReleaseURL: data.appVersionReleaseURL ?? null,
    hashboardUrl: data.hashboardURL ?? null,
    ui: data.ui ?? DEFAULT_UI_FEATURES,
    remote: data.remote ?? false,
  };
};
