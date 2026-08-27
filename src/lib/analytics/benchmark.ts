/**
 * Benchmarking primitives — ranking and traffic-light status.
 *
 * The reference dealership dashboard leans on one convention throughout: green on-target, amber
 * caution, red problem, plus a rank. That convention is only honest if the thresholds are stated
 * and applied identically everywhere, so it lives here rather than being re-decided per table.
 *
 * Status is always assigned **relative to the group's own figure**, never to an invented industry
 * benchmark: this dataset gives no external baseline, and inventing one would be exactly the kind
 * of fabricated number the project constitution forbids. "Good" means measurably ahead of the
 * group, "critical" means measurably behind it, and the UI always shows the group figure beside
 * the badge so the reader can see what the judgement was made against.
 */

export type PerfStatus = "good" | "warning" | "critical" | "neutral";

/** Relative gap thresholds, in percentage points, applied to rate-style metrics (0-100). */
export const BENCHMARK = {
  /** At or above group + this many points -> good. */
  goodGapPoints: 5,
  /** At or below group - this many points -> critical. */
  criticalGapPoints: 10,
  /** Below this sample size, no status is assigned at all (never judge a tiny denominator). */
  minSample: 15,
} as const;

/**
 * Compares a rate against the group rate and returns a traffic-light status.
 * Returns "neutral" — not a guess — when the value is null or the sample is too small.
 */
export function statusVsGroup(
  value: number | null,
  groupValue: number | null,
  sample: number,
  opts: { higherIsBetter?: boolean } = {},
): PerfStatus {
  const higherIsBetter = opts.higherIsBetter ?? true;
  if (value === null || groupValue === null) return "neutral";
  if (sample < BENCHMARK.minSample) return "neutral";

  const gap = higherIsBetter ? value - groupValue : groupValue - value;
  if (gap >= BENCHMARK.goodGapPoints) return "good";
  if (gap <= -BENCHMARK.criticalGapPoints) return "critical";
  if (gap < 0) return "warning";
  return "neutral";
}

export interface Ranked<T> {
  row: T;
  rank: number;
  /** 0 = worst, 1 = best. Used only for ordering and bar widths, never shown as a figure. */
  percentile: number;
}

/**
 * Ranks rows by a numeric accessor, descending by default. Nulls always sort last regardless of
 * direction — an unmeasurable entity is not "worst", it is unranked, and the UI shows it as such.
 * Ties share the lower rank number, and the final order is made total by a string tiebreak so
 * repeated renders never reshuffle equal rows.
 */
export function rankBy<T>(
  rows: readonly T[],
  value: (row: T) => number | null,
  tiebreak: (row: T) => string,
  direction: "desc" | "asc" = "desc",
): Ranked<T>[] {
  const sorted = [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null && bv === null) return tiebreak(a).localeCompare(tiebreak(b));
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return direction === "desc" ? bv - av : av - bv;
    return tiebreak(a).localeCompare(tiebreak(b));
  });

  let lastValue: number | null | undefined;
  let lastRank = 0;
  return sorted.map((row, i) => {
    const v = value(row);
    const rank = v !== null && v === lastValue ? lastRank : i + 1;
    lastValue = v;
    lastRank = rank;
    return {
      row,
      rank,
      percentile: sorted.length <= 1 ? 1 : 1 - i / (sorted.length - 1),
    };
  });
}

/** Safe rate helper — returns null rather than NaN/Infinity on a zero denominator (SC-006). */
export function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}

/** Safe mean — null on an empty set rather than NaN. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Median, null on an empty set. Sorts a copy; never mutates the input. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] as number;
  return (((s[mid - 1] as number) + (s[mid] as number)) / 2) as number;
}
