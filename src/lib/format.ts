// Deliberately NOT server-only: these are pure display-formatting functions with zero dataset
// access, and client components (charts, tooltips) legitimately need them to format axis labels
// and figures. The Constitution I guard belongs on lib/data/dataset.ts, which actually holds the
// 620 KB dataset — applying it here too was over-broad and blocks client formatting entirely
// (found when ComparisonBar.tsx, a client component, failed to build). See decision-log.md.
const ONE_LAKH = 100_000;
const ONE_CRORE = 100 * ONE_LAKH;

const indianGrouping = new Intl.NumberFormat("en-IN");

/**
 * Indian lakh/crore currency notation (Constitution VII, FR-034). Convention, fixed here so every
 * call site agrees:
 *   >= ₹1,00,00,000  → "₹X.XX Cr"
 *   >= ₹1,00,000     → "₹X.XX L"
 *   below ₹1,00,000  → "₹X,XX,XXX" (Indian digit grouping, no raw unformatted digit dump)
 * Two decimal places, standard rounding. The dataset never actually produces a monetary figure
 * below ₹1 lakh (minimum single deal value is ₹7.5L), so the plain-rupee branch exists for
 * correctness on hypothetical zero/edge-case figures, not as a common path.
 */
export function formatCurrency(rupees: number): string {
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);

  if (abs >= ONE_CRORE) {
    return `${sign}₹${(abs / ONE_CRORE).toFixed(2)} Cr`;
  }
  if (abs >= ONE_LAKH) {
    return `${sign}₹${(abs / ONE_LAKH).toFixed(2)} L`;
  }
  // Rounded to whole rupees. This branch used to be unreachable — the smallest deal value in the
  // dataset is ₹7.5 L — so it went unnoticed that `Intl` happily renders the fractional part. The
  // rep head-to-head made it reachable (revenue per lead can fall below ₹1 lakh) and it surfaced
  // as "₹45,909.091", which is three decimal places of false precision on a derived average.
  return `${sign}₹${indianGrouping.format(Math.round(abs))}`;
}

/** Plain count with Indian digit grouping — e.g. 1,426. */
export function formatCount(value: number): string {
  return indianGrouping.format(Math.round(value));
}

/**
 * Percentages are carried through the analytics layer already scaled to 0–100 (58.2, not 0.582)
 * — the convention every analytics module and every fixture in data-model.md §9 uses.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDays(days: number): string {
  return `${formatCount(days)} ${days === 1 ? "day" : "days"}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  /** Absolute difference in the metric's own unit — never a relative percent-of-percent. */
  change: number;
  direction: DeltaDirection;
  /** e.g. "vs previous 90 days". Supplied by the analytics layer, not built here. */
  basis: string;
}

const DELTA_ARROW: Record<DeltaDirection, string> = { up: "▲", down: "▼", flat: "—" };

/**
 * Renders a Delta whose `change` is already in the metric's display unit (rupees, count, or
 * percentage points). `change` is deliberately an absolute difference, not a relative percentage
 * of the prior value: a relative "+50%" on a rate metric (e.g. conversion rate 10%→15%) reads as
 * misleading noise next to an absolute "+5pp", and a relative change is undefined/explosive when
 * the prior-period value is zero. formatCurrency/formatPercent/formatCount handle magnitude; this
 * only adds the sign and arrow.
 */
export function formatDelta(
  delta: Delta | null,
  unit: "rupees" | "count" | "pct",
  decimals = 1,
): string {
  if (delta === null) {
    return "No prior period to compare";
  }
  const arrow = DELTA_ARROW[delta.direction];
  const magnitude = Math.abs(delta.change);
  const sign = delta.direction === "down" ? "-" : delta.direction === "up" ? "+" : "";

  let formattedMagnitude: string;
  if (unit === "rupees") {
    formattedMagnitude = formatCurrency(magnitude);
  } else if (unit === "pct") {
    formattedMagnitude = `${magnitude.toFixed(decimals)}pp`;
  } else {
    formattedMagnitude = formatCount(magnitude);
  }

  return `${arrow} ${sign}${formattedMagnitude} ${delta.basis}`;
}
