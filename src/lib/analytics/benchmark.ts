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

/**
 * Five states, each meaning exactly one thing.
 *
 * The earlier set had four, and `neutral` was doing two unrelated jobs: "we will not judge this,
 * the sample is too small" *and* "this sits within a few points of the group". Both rendered as a
 * dash labelled "No reading", so a rep 3 points ahead of the group looked identical to one whose
 * figures we were deliberately refusing to rate -- and a rep 43 points *behind* on a 12-lead book
 * also showed that dash. That is worse than saying nothing, because it reads as a claim.
 *
 * `onPar` and `unrated` split those apart, and the bands are symmetric so "slightly ahead" has a
 * label of its own rather than falling into the unmeasured bucket.
 */
export type PerfStatus = "good" | "onPar" | "warning" | "critical" | "unrated";

/**
 * Relative gap thresholds, in percentage points, applied to rate-style metrics (0-100).
 *
 * The bands are contiguous and exhaustive, so every measurable entity gets exactly one status:
 *
 *   gap >= +5          ahead of the group
 *   -5 <  gap <  +5    in line with the group
 *   -10 < gap <= -5    behind the group
 *   gap <= -10         well behind the group
 *
 * Asymmetric at the bottom on purpose: being ten points behind is a different kind of problem from
 * being five ahead, and that extra band is where a manager's attention should go.
 */
export const BENCHMARK = {
  /** At or above group + this many points -> ahead. */
  goodGapPoints: 5,
  /** Within this many points either way -> in line with the group. */
  onParGapPoints: 5,
  /** At or below group - this many points -> well behind. */
  criticalGapPoints: 10,
  /** Below this sample size, no judgement is made at all (never rate a tiny denominator). */
  minSample: 15,
} as const;

/**
 * Compares a rate against the group rate and returns a traffic-light status.
 *
 * Returns "unrated" -- explicitly not a judgement -- when the value is unmeasurable or the sample
 * is below the floor. Everything measurable lands in exactly one of the four graded bands.
 */
export function statusVsGroup(
  value: number | null,
  groupValue: number | null,
  sample: number,
  opts: { higherIsBetter?: boolean } = {},
): PerfStatus {
  const higherIsBetter = opts.higherIsBetter ?? true;
  if (value === null || groupValue === null) return "unrated";
  if (sample < BENCHMARK.minSample) return "unrated";

  const gap = higherIsBetter ? value - groupValue : groupValue - value;
  if (gap >= BENCHMARK.goodGapPoints) return "good";
  if (gap <= -BENCHMARK.criticalGapPoints) return "critical";
  if (gap <= -BENCHMARK.onParGapPoints) return "warning";
  return "onPar";
}

export interface Benchmarked {
  status: PerfStatus;
  /** Signed difference from the group figure, in percentage points. Null when unrated. */
  gapPoints: number | null;
  /** Ready-made tooltip: the comparison spelled out, so the glyph never has to be guessed at. */
  title: string;
}

/**
 * One call per benchmarked cell: the status, the gap, and the sentence that explains both.
 *
 * Bundled together because a bare glyph is not self-describing -- the reader has to be told what it
 * was measured against and by how much. Call sites were previously repeating that comparison by
 * hand, or omitting it entirely.
 */
export function benchmark(
  value: number | null,
  groupValue: number | null,
  sample: number,
  opts: { label?: string; higherIsBetter?: boolean } = {},
): Benchmarked {
  const status = statusVsGroup(value, groupValue, sample, opts);
  const what = opts.label ?? "This figure";

  if (status === "unrated") {
    const why =
      value === null || groupValue === null
        ? "cannot be calculated here"
        : `rests on ${sample} ${sample === 1 ? "lead" : "leads"}, below the ${BENCHMARK.minSample}-lead floor for a fair comparison`;
    return { status, gapPoints: null, title: `Not rated: ${what.toLowerCase()} ${why}.` };
  }

  const gap = (value as number) - (groupValue as number);
  const rounded = Math.round(gap * 10) / 10;
  const direction = rounded > 0 ? "above" : rounded < 0 ? "below" : "level with";
  const magnitude = rounded === 0 ? "" : `${Math.abs(rounded)}pp `;
  return {
    status,
    gapPoints: rounded,
    title: `${what}: ${magnitude}${direction} the group figure of ${(groupValue as number).toFixed(1)}%, on ${sample} leads.`,
  };
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
