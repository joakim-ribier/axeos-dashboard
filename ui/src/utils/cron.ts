// src/utils/cron.ts
import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";

import "cronstrue/locales/fr";

// Mirrors the field spec the server-side scheduler and config.ValidateCronSchedule
// use (seconds field included, e.g. "59 59 23 * * FRI") -- everything here
// is purely for the live preview in ScheduleEditor, the actual save is
// still validated server-side.

/** Human-readable translation of a cron expression (e.g. "At 23:59:59, only
 * on Friday"), in the given locale ("en" or "fr"), or null if it doesn't
 * parse. */
export function describeCron(expr: string, locale: string): string | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  try {
    return cronstrue.toString(trimmed, {
      throwExceptionOnParseError: true,
      locale: locale.startsWith("fr") ? "fr" : "en",
    });
  } catch {
    return null;
  }
}

/** The next `count` dates this cron expression would fire at, or null if it
 * doesn't parse. */
export function nextCronRuns(expr: string, count = 3): Date[] | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  try {
    const interval = CronExpressionParser.parse(trimmed);
    return Array.from({ length: count }, () => interval.next().toDate());
  } catch {
    return null;
  }
}

/** Collapses whitespace and lowercases a cron expression, so two
 * expressions that only differ by spacing or by day/month name casing
 * (e.g. "FRI" vs "fri") compare equal -- mirrors
 * config.NormalizeCronExpression server-side. Used to catch a duplicate
 * schedule entry before it's even submitted. */
export function normalizeCronExpression(expr: string): string {
  return expr.trim().split(/\s+/).join(" ").toLowerCase();
}
