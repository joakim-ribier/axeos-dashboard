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
    appVersionStatus?: AppVersionStatus;
    appVersionReleaseURL?: string;
    hashboardURL?: string;
    ui?: UIFeatures;
    remote?: boolean;
  }>("/api/info");
  return {
    buildSHA: data.buildSHA,
    appVersionStatus: data.appVersionStatus ?? "unknown",
    appVersionReleaseURL: data.appVersionReleaseURL ?? null,
    hashboardUrl: data.hashboardURL ?? null,
    ui: data.ui ?? DEFAULT_UI_FEATURES,
    remote: data.remote ?? false,
  };
};
