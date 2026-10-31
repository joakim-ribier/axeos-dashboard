// src/components/ui/thresholdInput.ts

// The bounds the server accepts (handler.validateAlertThresholds).
export const THRESHOLD_BOUNDS = {
  tempHigh: { min: 30, max: 100 },
  fanHigh: { min: 1, max: 100 },
} as const;

export type ThresholdKey = keyof typeof THRESHOLD_BOUNDS;

/** A threshold field's value: "" is unset (0 to the server). */
export const toThreshold = (value: string): number =>
  value.trim() === "" ? 0 : Number(value.replace(",", "."));

export const fromThreshold = (value: number | undefined): string =>
  value ? String(value) : "";

export const thresholdInvalid = (key: ThresholdKey, value: string) => {
  if (value.trim() === "") return false;
  const n = toThreshold(value);
  const { min, max } = THRESHOLD_BOUNDS[key];
  return Number.isNaN(n) || n < min || n > max;
};
