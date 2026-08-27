import type { AnalyticsContext } from "./context";
import type { TimePreset } from "@/lib/filters/types";
import { formatCount } from "@/lib/format";
import { median } from "./benchmark";

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  change: number;
  direction: DeltaDirection;
  basis: string;
}

export type KpiKey =
  | "deliveredUnits"
  | "deliveredRevenue"
  | "conversionRate"
  | "testDriveRate"
  | "avgCycleDays"
  | "openPipelineValue"
  | "attainment";

export interface Kpi {
  key: KpiKey;
  /** null when the metric is genuinely undefined (e.g. a rate over zero leads) — never NaN/0-as-fact. */
  value: number | null;
  unit: "count" | "rupees" | "pct" | "days";
  delta: Delta | null;
  caveat?: string;
}

export interface KpiSet {
  deliveredUnits: Kpi;
  deliveredRevenue: Kpi;
  conversionRate: Kpi;
  /**
   * Test drives as a share of contacted leads. Promoted to a headline metric in v2 because it is
   * the single strongest predictor of revenue in this dataset — no lead has ever been delivered
   * without one — and it is the earliest number a manager can still act on.
   */
  testDriveRate: Kpi;
  /**
   * Median days from lead creation to delivery, for units delivered in the window.
   *
   * Named "sales cycle", deliberately not "average days to sell": ADS in the classic sense is
   * days-in-inventory divided by units sold, and this dataset carries no inventory or stock
   * records at all, so that figure cannot be computed. This is the closest honest analogue and is
   * labelled as what it actually measures. See DECISIONS.md.
   */
  avgCycleDays: Kpi;
  openPipelineValue: Kpi;
  attainment: Kpi;
}

function directionFor(change: number): DeltaDirection {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

function basisTextFor(preset: TimePreset): string {
  switch (preset) {
    case "last30":
      return "vs previous 30 days";
    case "last90":
      return "vs previous 90 days";
    case "month":
      return "vs previous month";
    case "custom":
      return "vs previous period";
    case "full":
      return "vs previous period";
  }
}

function buildDelta(
  current: number | null,
  prior: number | null,
  hasPriorPeriod: boolean,
  basis: string,
): Delta | null {
  if (!hasPriorPeriod || current === null || prior === null) return null;
  const change = current - prior;
  return { change, direction: directionFor(change), basis };
}

function monthsOverlapping(from: Date, to: Date, availableMonths: readonly string[]): string[] {
  return availableMonths.filter((month) => {
    const parts = month.split("-").map(Number);
    const year = parts[0] ?? 0;
    const m = parts[1] ?? 1;
    const monthStart = new Date(Date.UTC(year, m - 1, 1));
    const monthEnd = new Date(Date.UTC(year, m, 0));
    return monthStart <= to && monthEnd >= from;
  });
}

function conversionRatePct(leads: { reachedStages: ReadonlySet<string> }[]): number | null {
  if (leads.length === 0) return null;
  const delivered = leads.filter((l) => l.reachedStages.has("delivered")).length;
  return (delivered / leads.length) * 100;
}

function testDriveRatePct(
  leads: { wasContacted: boolean; tookTestDrive: boolean }[],
): number | null {
  const contacted = leads.filter((l) => l.wasContacted);
  if (contacted.length === 0) return null;
  return (contacted.filter((l) => l.tookTestDrive).length / contacted.length) * 100;
}

/**
 * Attainment excludes branch-months with no target row from the denominator entirely — a missing
 * target is never coerced to zero (spec edge case: Missing targets). Returns null (not 0/NaN) when
 * no target rows exist in scope at all.
 */
function attainmentFor(
  ctx: AnalyticsContext,
  deliveredUnits: number,
): { pct: number | null; targetTotal: number } {
  const months = monthsOverlapping(ctx.filters.from, ctx.filters.to, ctx.dataset.months);
  const branchIds = ctx.filters.branchId
    ? [ctx.filters.branchId]
    : ctx.dataset.branches.map((b) => b.id);

  let targetTotal = 0;
  for (const branchId of branchIds) {
    for (const month of months) {
      const target = ctx.dataset.targetsByBranchMonth.get(`${branchId}:${month}`);
      if (target) targetTotal += target.target_units;
    }
  }
  if (targetTotal === 0) return { pct: null, targetTotal };
  return { pct: (deliveredUnits / targetTotal) * 100, targetTotal };
}

export function computeKpis(ctx: AnalyticsContext): KpiSet {
  const basis = basisTextFor(ctx.filters.preset);

  const deliveredUnits = ctx.deliveries.length;
  const deliveredRevenue = ctx.deliveries.reduce((sum, d) => sum + d.lead.dealValue, 0);
  const priorDeliveredUnits = ctx.priorDeliveries.length;
  const priorDeliveredRevenue = ctx.priorDeliveries.reduce((sum, d) => sum + d.lead.dealValue, 0);

  const convPct = conversionRatePct(ctx.leads);
  const priorConvPct = conversionRatePct(ctx.priorLeads);

  const tdPct = testDriveRatePct(ctx.leads);
  const priorTdPct = testDriveRatePct(ctx.priorLeads);

  // Cycle time is a property of units *delivered* in the window, so it follows the delivery-date
  // scope rather than the lead-creation scope (FR-030). Median rather than mean: the distribution
  // has a long right arm and a mean overstates the typical journey.
  const cycleDays = median(
    ctx.deliveries.map((d) => d.lead.cycleDays).filter((v): v is number => v !== null),
  );
  const priorCycleDays = median(
    ctx.priorDeliveries.map((d) => d.lead.cycleDays).filter((v): v is number => v !== null),
  );

  // Detection-scoped, not window-scoped: open pipeline is a present-tense fact about leads
  // currently in flight, not a property of a historical time window (contracts/analytics-api.md).
  const openPipelineValue = ctx.detectionLeads
    .filter((l) => l.isOpen)
    .reduce((sum, l) => sum + l.dealValue, 0);

  const { pct: attainmentPct, targetTotal } = attainmentFor(ctx, deliveredUnits);

  return {
    deliveredUnits: {
      key: "deliveredUnits",
      value: deliveredUnits,
      unit: "count",
      delta: buildDelta(deliveredUnits, priorDeliveredUnits, ctx.hasPriorPeriod, basis),
    },
    deliveredRevenue: {
      key: "deliveredRevenue",
      value: deliveredRevenue,
      unit: "rupees",
      delta: buildDelta(deliveredRevenue, priorDeliveredRevenue, ctx.hasPriorPeriod, basis),
    },
    conversionRate: {
      key: "conversionRate",
      value: convPct,
      unit: "pct",
      delta: buildDelta(convPct, priorConvPct, ctx.hasPriorPeriod, basis),
    },
    testDriveRate: {
      key: "testDriveRate",
      value: tdPct,
      unit: "pct",
      delta: buildDelta(tdPct, priorTdPct, ctx.hasPriorPeriod, basis),
    },
    avgCycleDays: {
      key: "avgCycleDays",
      value: cycleDays,
      unit: "days",
      // Falling is better here, so the tile inverts the usual good/bad colouring — handled in the
      // component via `lowerIsBetter`, not by flipping the sign of the number itself.
      delta: buildDelta(cycleDays, priorCycleDays, ctx.hasPriorPeriod, basis),
    },
    openPipelineValue: {
      key: "openPipelineValue",
      value: openPipelineValue,
      unit: "rupees",
      // A point-in-time snapshot of currently-open value, not a windowed sum — a "prior period"
      // comparison isn't meaningful the same way it is for deliveries created within a window.
      delta: null,
    },
    attainment: {
      key: "attainment",
      value: attainmentPct,
      unit: "pct",
      delta: null,
      caveat:
        targetTotal > 0
          ? `Official targets total ${formatCount(targetTotal)} units for this period — far above ` +
            `demonstrated capacity. Read as a trend and branch-comparison signal, not a literal gap.`
          : "No official targets are set for this period.",
    },
  };
}
