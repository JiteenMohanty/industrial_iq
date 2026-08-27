import type { AnalyticsContext } from "./context";
import type { EnrichedLead } from "@/lib/data/types";

export interface DeliveryOpsResult {
  avgDays: number;
  minDays: number;
  maxDays: number;
  delayedCount: number;
  totalCount: number;
}

export interface DelayReasonBucket {
  reason: string;
  count: number;
  pctOfDelayed: number;
}

export interface BranchDeliveryPerf {
  branchId: string;
  branchLabel: string;
  deliveredCount: number;
  avgDays: number;
  delayedPct: number;
}

export function computeDeliveryOps(ctx: AnalyticsContext): DeliveryOpsResult {
  const deliveries = ctx.deliveries;
  const days = deliveries.map((d) => d.daysToDeliver);
  const delayed = deliveries.filter((d) => d.isDelayed);

  return {
    avgDays: days.length > 0 ? days.reduce((sum, d) => sum + d, 0) / days.length : 0,
    minDays: days.length > 0 ? Math.min(...days) : 0,
    maxDays: days.length > 0 ? Math.max(...days) : 0,
    delayedCount: delayed.length,
    totalCount: deliveries.length,
  };
}

export function computeDelayReasons(ctx: AnalyticsContext): DelayReasonBucket[] {
  const delayed = ctx.deliveries.filter((d) => d.isDelayed && d.delayReason);
  const byReason = new Map<string, number>();
  for (const d of delayed) {
    const reason = d.delayReason as string;
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }

  return Array.from(byReason.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      pctOfDelayed: delayed.length > 0 ? (count / delayed.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeDeliveryByBranch(ctx: AnalyticsContext): BranchDeliveryPerf[] {
  return ctx.dataset.branches.map((branch) => {
    const deliveries = ctx.windowDeliveries.filter((d) => d.lead.branchId === branch.id);
    const days = deliveries.map((d) => d.daysToDeliver);
    const delayed = deliveries.filter((d) => d.isDelayed);

    return {
      branchId: branch.id,
      branchLabel: branch.label,
      deliveredCount: deliveries.length,
      avgDays: days.length > 0 ? days.reduce((sum, d) => sum + d, 0) / days.length : 0,
      delayedPct: deliveries.length > 0 ? (delayed.length / deliveries.length) * 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Promise reliability (v2)
// ---------------------------------------------------------------------------------------------

/**
 * Every lead carries an `expected_close_date` — a date the dealership put in front of a customer.
 * Comparing it against the actual delivery timestamp measures something no other metric here
 * does: whether the group keeps the promises it makes.
 *
 * This turned out to be one of the more uncomfortable findings in the dataset, because it does not
 * follow revenue. Eastside is the highest-revenue branch in the group and the *worst* at hitting
 * the date it quoted (63.8% late, median seven days over); Central sells less and beats its quoted
 * date more often than not. A units-and-revenue dashboard cannot see that at all.
 */
export interface PromiseReliability {
  delivered: number;
  onTimeOrEarly: number;
  late: number;
  latePct: number | null;
  /** Median signed slip in days. Negative = typically early. */
  medianSlipDays: number | null;
  worstSlipDays: number | null;
}

export interface BranchPromiseReliability extends PromiseReliability {
  branchId: string;
  branchName: string;
  branchLabel: string;
}

function reliabilityOf(leads: readonly EnrichedLead[]): PromiseReliability {
  const withSlip = leads
    .map((l) => l.closeSlipDays)
    .filter((v): v is number => v !== null);
  const late = withSlip.filter((s) => s > 0);
  return {
    delivered: withSlip.length,
    onTimeOrEarly: withSlip.length - late.length,
    late: late.length,
    latePct: rateOrNull(late.length, withSlip.length),
    medianSlipDays: medianOrNull(withSlip),
    worstSlipDays: withSlip.length ? Math.max(...withSlip) : null,
  };
}

function rateOrNull(n: number, d: number): number | null {
  return d === 0 ? null : (n / d) * 100;
}

function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] as number;
  return (((s[mid - 1] as number) + (s[mid] as number)) / 2) as number;
}

export function computePromiseReliability(ctx: AnalyticsContext): PromiseReliability {
  return reliabilityOf(ctx.leads);
}

export function computePromiseReliabilityByBranch(
  ctx: AnalyticsContext,
): BranchPromiseReliability[] {
  return ctx.dataset.branches
    .map((branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      branchLabel: branch.label,
      ...reliabilityOf(ctx.windowLeads.filter((l) => l.branchId === branch.id)),
    }))
    .sort((a, b) => (a.latePct ?? 0) - (b.latePct ?? 0));
}

/** Distribution of signed slip, bucketed, for the deliveries page histogram. */
export interface SlipBucket {
  label: string;
  count: number;
  isLate: boolean;
}

export function computeSlipDistribution(ctx: AnalyticsContext): SlipBucket[] {
  const slips = ctx.leads
    .map((l) => l.closeSlipDays)
    .filter((v): v is number => v !== null);
  const buckets: { label: string; test: (s: number) => boolean; isLate: boolean }[] = [
    { label: "8+ days early", test: (s) => s <= -8, isLate: false },
    { label: "1–7 days early", test: (s) => s < 0 && s > -8, isLate: false },
    { label: "On the day", test: (s) => s === 0, isLate: false },
    { label: "1–7 days late", test: (s) => s > 0 && s <= 7, isLate: true },
    { label: "8–14 days late", test: (s) => s > 7 && s <= 14, isLate: true },
    { label: "15+ days late", test: (s) => s > 14, isLate: true },
  ];
  return buckets.map((b) => ({
    label: b.label,
    count: slips.filter(b.test).length,
    isLate: b.isLate,
  }));
}
