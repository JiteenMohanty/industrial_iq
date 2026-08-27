import type { AnalyticsContext } from "./context";

export interface StuckOrder {
  /** Carried so the watchlist can show what the customer is actually waiting for. */
  modelInterested: string;
  leadId: string;
  customerName: string;
  branchLabel: string;
  branchId: string;
  repName: string;
  model: string;
  dealValueRupees: number;
  daysSinceOrder: number;
}

export interface PipelineSummary {
  count: number;
  totalValueRupees: number;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  count: number;
  valueRupees: number;
}

/**
 * All 38 undelivered placed orders (FR-018/019) — deliberately every one, not just the subset
 * that fires the stuck-orders insight rule (>=27 days). Conflating the two is the specific bug
 * research.md R4 exists to prevent; the 25-alerting figure is a filtered view of this same list,
 * not a separate query.
 *
 * Sorted oldest-first, tie-broken by value descending — both components are exposed on every row
 * so the reader can verify the ordering themselves (spec assumption: Ranking of stuck orders).
 */
export function computeStuckOrders(ctx: AnalyticsContext): StuckOrder[] {
  const stuck = ctx.detectionLeads.filter((l) => l.isStuckOrder && l.daysSinceOrder !== null);

  return stuck
    .map((l) => ({
      leadId: l.id,
      customerName: l.customerName,
      modelInterested: l.modelInterested,
      branchLabel: l.branch.label,
      branchId: l.branchId,
      repName: l.rep.name,
      model: l.modelInterested,
      dealValueRupees: l.dealValue,
      daysSinceOrder: l.daysSinceOrder as number,
    }))
    .sort((a, b) => {
      if (a.daysSinceOrder !== b.daysSinceOrder) return b.daysSinceOrder - a.daysSinceOrder;
      return b.dealValueRupees - a.dealValueRupees;
    });
}

/** Present-tense snapshot of every currently open lead's value — detection-scoped, not windowed. */
export function computeOpenPipeline(ctx: AnalyticsContext): PipelineSummary {
  const open = ctx.detectionLeads.filter((l) => l.isOpen);
  return {
    count: open.length,
    totalValueRupees: open.reduce((sum, l) => sum + l.dealValue, 0),
  };
}

/**
 * Explicit, non-overlapping day ranges rather than a generic "find the nearest upper bound"
 * loop — a first attempt at the latter picked the wrong upper bound for the 7-13 bucket (array
 * iteration order isn't the same as "nearest greater threshold"), caught by the bucket-total
 * test failing. Three fixed buckets don't need cleverness.
 */
export function computeAgingBuckets(ctx: AnalyticsContext): AgingBucket[] {
  const open = ctx.detectionLeads.filter((l) => l.isOpen);

  const ranges: readonly { label: string; minDays: number; maxDaysExclusive: number | null }[] = [
    { label: "30+ days", minDays: 30, maxDaysExclusive: null },
    { label: "14-29 days", minDays: 14, maxDaysExclusive: 30 },
    { label: "7-13 days", minDays: 7, maxDaysExclusive: 14 },
  ];

  return ranges.map(({ label, minDays, maxDaysExclusive }) => {
    const inBucket = open.filter(
      (l) =>
        l.daysSinceActivity >= minDays &&
        (maxDaysExclusive === null || l.daysSinceActivity < maxDaysExclusive),
    );
    return {
      label,
      minDays,
      count: inBucket.length,
      valueRupees: inBucket.reduce((sum, l) => sum + l.dealValue, 0),
    };
  });
}
