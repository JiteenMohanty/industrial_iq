import type { AnalyticsContext } from "./context";

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
  const deliveries = ctx.groupDeliveries;
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
  const delayed = ctx.groupDeliveries.filter((d) => d.isDelayed && d.delayReason);
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
    const deliveries = ctx.groupDeliveries.filter((d) => d.lead.branchId === branch.id);
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
