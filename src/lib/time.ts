// Not server-only, for the same reason as format.ts: every function here is pure date
// arithmetic with zero dataset access. `computeDataAsOf` takes a lead array as a parameter, but
// that's a type signature, not a coupling to the dataset singleton — the guard that actually
// matters lives on lib/data/dataset.ts.
import type { RawLead } from "@/lib/data/types";

/**
 * DATA_AS_OF = the maximum timestamp across every lead's created_at, last_activity_at, and
 * status_history entries. Computed here, called once by dataset.ts at module scope, and carried
 * from there as `Dataset.dataAsOf` / `AnalyticsContext.asOf` (Constitution VII — computed, never
 * hardcoded). Lead timestamps run later than delivery dates in this extract, so scanning leads
 * alone is sufficient and correct.
 */
export function computeDataAsOf(leads: readonly RawLead[]): Date {
  let max = -Infinity;
  for (const lead of leads) {
    max = Math.max(max, Date.parse(lead.created_at), Date.parse(lead.last_activity_at));
    for (const entry of lead.status_history) {
      max = Math.max(max, Date.parse(entry.timestamp));
    }
  }
  if (!Number.isFinite(max)) {
    throw new Error("computeDataAsOf: no leads supplied, cannot determine DATA_AS_OF");
  }
  return new Date(max);
}

/**
 * The actual wall-clock date. Used ONLY by the freshness banner ("N months behind live") —
 * nothing else in the product may read the system clock (Constitution VII).
 */
export function getRealNow(): Date {
  return new Date();
}

function floorToUtcDate(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Start of the UTC calendar day. Exported for range-boundary comparisons (lib/filters/apply.ts)
 * so a `to` bound of "2025-07-01" (parsed as midnight) still includes every lead created later
 * that same day — comparing raw Date instants instead would silently exclude anything after
 * midnight on the boundary day.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(floorToUtcDate(date));
}

/**
 * Whole days between two dates, both floored to their UTC calendar date first. Flooring first
 * means a threshold comparison (e.g. "≥27 days") is stable regardless of the time-of-day embedded
 * in either timestamp — without it, two leads created hours apart on the same calendar day could
 * land on opposite sides of a threshold.
 */
export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((floorToUtcDate(to) - floorToUtcDate(from)) / MS_PER_DAY);
}

export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  );
}

export function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
