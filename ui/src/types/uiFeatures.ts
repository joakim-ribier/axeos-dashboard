// src/types/uiFeatures.ts

// Mirrors server/internal/config.UIVisibility. What "readonly" means is up
// to whichever component reads it -- see server/internal/config/config.go.
export type UIVisibility = "enabled" | "readonly" | "hidden";

export interface UIFeatures {
  page: {
    settings: UIVisibility;
  };
  action: {
    minerRestart: UIVisibility;
    minerPoolSwitch: UIVisibility;
  };
}

// Everything shown/usable -- the fallback while GET /api/info hasn't
// resolved yet, and what an instance with no ui: block in its config
// effectively gets server-side too (see UIVisibility.Normalized).
export const DEFAULT_UI_FEATURES: UIFeatures = {
  page: { settings: "enabled" },
  action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
};
