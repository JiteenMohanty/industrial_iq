import type { AnalyticsContext } from "./context";

export interface MonthPoint {
  month: string; // "YYYY-MM"
  deliveredUnits: number;
  deliveredRevenue: number;
  leadsCreated: number;
}

export interface BranchSparkline {
  branchId: string;
  branchLabel: string;
  points: { month: string; deliveredUnits: number }[];
}

/**
 * Monthly trend across the full dataset, not window-scoped — a trend line is only meaningful
 * shown across every covered month regardless of the reader's current filter, so this always
 * reads from `ctx.groupDeliveries`/`ctx.groupLeads` rather than `ctx.deliveries`/`ctx.leads`.
 */
export function computeMonthlyTrend(ctx: AnalyticsContext): MonthPoint[] {
  return ctx.dataset.months.map((month) => {
    const deliveries = ctx.groupDeliveries.filter((d) => d.deliveryMonth === month);
    const leadsCreated = ctx.groupLeads.filter(
      (l) => l.createdAt.toISOString().slice(0, 7) === month,
    ).length;
    return {
      month,
      deliveredUnits: deliveries.length,
      deliveredRevenue: deliveries.reduce((sum, d) => sum + d.lead.dealValue, 0),
      leadsCreated,
    };
  });
}

export function computeBranchSparklines(ctx: AnalyticsContext): BranchSparkline[] {
  return ctx.dataset.branches.map((branch) => {
    const branchDeliveries = ctx.groupDeliveries.filter((d) => d.lead.branchId === branch.id);
    const points = ctx.dataset.months.map((month) => ({
      month,
      deliveredUnits: branchDeliveries.filter((d) => d.deliveryMonth === month).length,
    }));
    return { branchId: branch.id, branchLabel: branch.label, points };
  });
}
