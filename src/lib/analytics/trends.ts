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

// ---------------------------------------------------------------------------------------------
// v2 trends
// ---------------------------------------------------------------------------------------------

/**
 * Monthly revenue and units on the delivery-date basis, plus the median sales cycle of the units
 * delivered in that month.
 *
 * Cycle time is carried on the same row deliberately but is *never* plotted on the same axis as
 * revenue — two measures of different scale get two charts or an indexed view, never a dual axis.
 * The relationship matters though: over this dataset revenue roughly quadruples from July to
 * December while the median cycle stretches from 33 to 42 days, which is the signature of a group
 * growing faster than its process.
 */
export interface RevenueTrendPoint {
  month: string;
  label: string;
  units: number;
  revenueRupees: number;
  medianCycleDays: number | null;
  targetUnits: number;
  attainmentPct: number | null;
  /** Leads created in this month — supply, on the creation basis, not the delivery basis. */
  leadsCreated: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function labelFor(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${(y ?? "").slice(2)}`;
}

function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] as number;
  return (((s[mid - 1] as number) + (s[mid] as number)) / 2) as number;
}

export function computeRevenueTrend(ctx: AnalyticsContext): RevenueTrendPoint[] {
  return ctx.dataset.months.map((month) => {
    const deliveries = ctx.windowDeliveries.filter((d) => d.deliveryMonth === month);
    const branchIds = ctx.filters.branchId
      ? [ctx.filters.branchId]
      : ctx.dataset.branches.map((b) => b.id);
    const scoped = ctx.filters.branchId
      ? deliveries.filter((d) => d.lead.branchId === ctx.filters.branchId)
      : deliveries;

    let targetUnits = 0;
    for (const branchId of branchIds) {
      const t = ctx.dataset.targetsByBranchMonth.get(`${branchId}:${month}`);
      if (t) targetUnits += t.target_units;
    }

    return {
      month,
      label: labelFor(month),
      units: scoped.length,
      revenueRupees: scoped.reduce((s, d) => s + d.lead.dealValue, 0),
      medianCycleDays: medianOf(
        scoped.map((d) => d.lead.cycleDays).filter((v): v is number => v !== null),
      ),
      targetUnits,
      attainmentPct: targetUnits === 0 ? null : (scoped.length / targetUnits) * 100,
      leadsCreated: ctx.windowLeads.filter(
        (l) =>
          l.createdAt.toISOString().slice(0, 7) === month &&
          (!ctx.filters.branchId || l.branchId === ctx.filters.branchId),
      ).length,
    };
  });
}

/**
 * Monthly gate rates on the lead-creation basis — is the group getting better or worse at the two
 * things that decide the outcome?
 *
 * A caveat this function cannot fix and the UI must state: conversion for a recently-created
 * cohort is right-censored. December's leads had a median of 37.7 days of runway before the data
 * ends, so their conversion reads near zero for reasons that have nothing to do with performance.
 * `isMature` marks the months far enough from the coverage end to be read as final.
 */
export interface GateTrendPoint {
  month: string;
  label: string;
  leads: number;
  contactRatePct: number | null;
  testDriveRatePct: number | null;
  conversionPct: number | null;
  isMature: boolean;
}

/** Median lead->delivery cycle across the whole dataset, rounded up — the maturity horizon. */
const MATURITY_DAYS = 45;

export function computeGateTrend(ctx: AnalyticsContext): GateTrendPoint[] {
  return ctx.dataset.months.map((month) => {
    const leads = ctx.windowLeads.filter(
      (l) =>
        l.createdAt.toISOString().slice(0, 7) === month &&
        (!ctx.filters.branchId || l.branchId === ctx.filters.branchId),
    );
    const contacted = leads.filter((l) => l.wasContacted);
    const testDriven = contacted.filter((l) => l.tookTestDrive);
    const delivered = leads.filter((l) => l.reachedStages.has("delivered"));

    // A month is mature when its *last* day is at least one median sales cycle before the data's
    // coverage end — i.e. even a lead created on the final day of the month had time to convert.
    const [y, m] = month.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(y ?? 0, m ?? 1, 0));
    const daysOfRunway = (ctx.asOf.getTime() - monthEnd.getTime()) / 86_400_000;

    return {
      month,
      label: labelFor(month),
      leads: leads.length,
      contactRatePct: leads.length === 0 ? null : (contacted.length / leads.length) * 100,
      testDriveRatePct:
        contacted.length === 0 ? null : (testDriven.length / contacted.length) * 100,
      conversionPct: leads.length === 0 ? null : (delivered.length / leads.length) * 100,
      isMature: daysOfRunway >= MATURITY_DAYS,
    };
  });
}
