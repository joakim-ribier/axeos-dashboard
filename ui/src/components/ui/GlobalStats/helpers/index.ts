// src/components/ui/GlobalStats/helpers/index.ts
export const getTrend = (current: number, previous: number | undefined) => {
  if (previous === undefined) return "neutral";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "neutral";
};

export const getPercentChange = (
  current: number,
  previous: number | undefined,
): number | null => {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};
