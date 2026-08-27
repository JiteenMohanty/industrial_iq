import type { AnalyticsContext } from "./context";
import type { EnrichedLead } from "@/lib/data/types";
import { rate, mean, median } from "./benchmark";

/**
 * Model / vehicle analytics.
 *
 * The first version of this product ignored `model_interested` entirely, which left a quarter of
 * the dataset's analytical surface unused — and with it the fact that revenue here is a
 * *mix* problem as much as a conversion problem: Fortuner is 18% of leads and 32% of revenue,
 * Glanza is 25% of leads and 10% of revenue. A dashboard that only counts units cannot see that.
 *
 * Note on price: `deal_value` is effectively determined by the model (each model's values sit in
 * a tight, near-non-overlapping band), so "average deal value" is really a mix indicator, not a
 * discounting or negotiation indicator. The UI says so where it matters rather than implying reps
 * are winning better prices.
 *
 * Scope: every function here reads the reader's current selection (branch + time). Demand mix is a
 * population view — "what did Lakeside's customers ask about in November" is the question this page
 * exists to answer — so both filters apply and revenue shares sum to 100% of what is on screen.
 */
export interface ModelPerformance {
  model: string;
  leads: number;
  contacted: number;
  testDriven: number;
  delivered: number;
  contactRatePct: number | null;
  /** Test drives as a share of *contacted* leads — the gate metric, not a share of all leads. */
  testDriveRatePct: number | null;
  conversionPct: number | null;
  revenueRupees: number;
  revenueSharePct: number | null;
  /** Median deal value of leads for this model — a price band, not an achieved discount. */
  medianPriceRupees: number | null;
  revenuePerLeadRupees: number | null;
  medianCycleDays: number | null;
  /** Value sitting in leads for this model that never reached a test drive. */
  strandedValueRupees: number;
}

export function computeModelPerformance(ctx: AnalyticsContext): ModelPerformance[] {
  const leads = ctx.leads;
  const totalRevenue = leads
    .filter((l) => l.reachedStages.has("delivered"))
    .reduce((s, l) => s + l.dealValue, 0);

  return ctx.dataset.models
    .map((model) => {
      const ls = leads.filter((l) => l.modelInterested === model);
      const contacted = ls.filter((l) => l.wasContacted);
      const testDriven = ls.filter((l) => l.tookTestDrive);
      const delivered = ls.filter((l) => l.reachedStages.has("delivered"));
      const revenue = delivered.reduce((s, l) => s + l.dealValue, 0);
      const stranded = ls.filter((l) => !l.tookTestDrive);

      return {
        model,
        leads: ls.length,
        contacted: contacted.length,
        testDriven: testDriven.length,
        delivered: delivered.length,
        contactRatePct: rate(contacted.length, ls.length),
        testDriveRatePct: rate(testDriven.length, contacted.length),
        conversionPct: rate(delivered.length, ls.length),
        revenueRupees: revenue,
        revenueSharePct: rate(revenue, totalRevenue),
        medianPriceRupees: median(ls.map((l) => l.dealValue)),
        revenuePerLeadRupees: ls.length === 0 ? null : revenue / ls.length,
        medianCycleDays: median(
          delivered.map((l) => l.cycleDays).filter((d): d is number => d !== null),
        ),
        strandedValueRupees: stranded.reduce((s, l) => s + l.dealValue, 0),
      };
    })
    .sort((a, b) => b.revenueRupees - a.revenueRupees);
}

// ------------------------------------------------------------------------------------------
// Customer-interest heatmap
// ------------------------------------------------------------------------------------------

export type HeatmapDimension = "branch" | "source" | "month";
export type HeatmapMetric = "volume" | "conversion" | "testDrive";

export interface HeatmapCell {
  rowKey: string;
  colKey: string;
  /** The encoded value — lead count, or a 0-100 rate. Null means "no leads in this cell". */
  value: number | null;
  /** Always the raw lead count, shown in the tooltip regardless of which metric is encoded. */
  leads: number;
  delivered: number;
  revenueRupees: number;
  /** Normalised 0-1 within the matrix, for the color ramp. Null cells get no fill. */
  intensity: number | null;
}

export interface HeatmapMatrix {
  rowLabel: string;
  colLabel: string;
  metric: HeatmapMetric;
  metricLabel: string;
  rows: { key: string; label: string; total: number }[];
  cols: { key: string; label: string; total: number }[];
  cells: HeatmapCell[];
  min: number | null;
  max: number | null;
  /**
   * Cells below this lead count get no status reading in the UI — a 1-lead cell showing "100%
   * conversion" is noise, and the heatmap must not invite that reading (FR-011a's principle,
   * applied to a visual rather than an alert).
   */
  minSampleForRate: number;
}

const MIN_SAMPLE_FOR_RATE = 5;

const METRIC_LABEL: Record<HeatmapMetric, string> = {
  volume: "Leads",
  conversion: "Conversion rate",
  testDrive: "Test-drive rate",
};

/**
 * Customer-interest heatmap: which models customers ask about, broken down by branch, acquisition
 * source, or month, and how well that interest is converted.
 *
 * This is a real analytical instrument, not decoration. Read by row it shows a model's demand
 * profile; read by column it shows a branch's or channel's mix; read as a field it shows where
 * demand and capability line up and where they do not — a branch with strong interest in a
 * high-value model and a cold cell against it is a specific, addressable commercial gap.
 */
export function computeInterestMatrix(
  ctx: AnalyticsContext,
  dimension: HeatmapDimension,
  metric: HeatmapMetric,
): HeatmapMatrix {
  const leads = ctx.leads;

  const colDefs =
    dimension === "branch"
      ? ctx.dataset.branches.map((b) => ({ key: b.id, label: b.name.replace(" Toyota", "") }))
      : dimension === "source"
        ? ctx.dataset.sources.map((s) => ({ key: s, label: s.replace(/_/g, " ") }))
        : ctx.dataset.months.map((m) => ({ key: m, label: monthLabel(m) }));

  const colOf = (l: EnrichedLead): string =>
    dimension === "branch"
      ? l.branchId
      : dimension === "source"
        ? l.source
        : l.createdAt.toISOString().slice(0, 7);

  const rowKeys = ctx.dataset.models;

  const cells: HeatmapCell[] = [];
  for (const rowKey of rowKeys) {
    for (const col of colDefs) {
      const ls = leads.filter((l) => l.modelInterested === rowKey && colOf(l) === col.key);
      const delivered = ls.filter((l) => l.reachedStages.has("delivered"));
      const contacted = ls.filter((l) => l.wasContacted);
      const testDriven = ls.filter((l) => l.tookTestDrive);

      let value: number | null;
      if (metric === "volume") {
        value = ls.length;
      } else if (metric === "conversion") {
        value = ls.length >= MIN_SAMPLE_FOR_RATE ? rate(delivered.length, ls.length) : null;
      } else {
        value =
          contacted.length >= MIN_SAMPLE_FOR_RATE
            ? rate(testDriven.length, contacted.length)
            : null;
      }

      cells.push({
        rowKey,
        colKey: col.key,
        value,
        leads: ls.length,
        delivered: delivered.length,
        revenueRupees: delivered.reduce((s, l) => s + l.dealValue, 0),
        intensity: null,
      });
    }
  }

  const values = cells.map((c) => c.value).filter((v): v is number => v !== null);
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;

  // Volume ramps from zero so cell area reads as absolute demand; rate metrics ramp between the
  // observed min and max so the spread that actually exists is visible rather than compressed
  // into the top of a 0-100 scale.
  for (const cell of cells) {
    if (cell.value === null || max === null || min === null) {
      cell.intensity = null;
      continue;
    }
    const lo = metric === "volume" ? 0 : min;
    cell.intensity = max === lo ? 1 : (cell.value - lo) / (max - lo);
  }

  const rows = rowKeys.map((key) => ({
    key,
    label: key,
    total: leads.filter((l) => l.modelInterested === key).length,
  }));
  const cols = colDefs.map((c) => ({
    ...c,
    total: leads.filter((l) => colOf(l) === c.key).length,
  }));

  return {
    rowLabel: "Model",
    colLabel: dimension === "branch" ? "Branch" : dimension === "source" ? "Source" : "Month",
    metric,
    metricLabel: METRIC_LABEL[metric],
    rows,
    cols,
    cells,
    min,
    max,
    minSampleForRate: MIN_SAMPLE_FOR_RATE,
  };
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1] ?? m} ${(y ?? "").slice(2)}`;
}

export interface ModelTrendPoint {
  month: string;
  label: string;
  byModel: Record<string, number>;
}

/** Interest over time per model — is demand shifting toward or away from the high-value end? */
export function computeModelTrend(ctx: AnalyticsContext): ModelTrendPoint[] {
  return ctx.dataset.months.map((month) => {
    const byModel: Record<string, number> = {};
    for (const model of ctx.dataset.models) {
      byModel[model] = ctx.leads.filter(
        (l) => l.modelInterested === model && l.createdAt.toISOString().slice(0, 7) === month,
      ).length;
    }
    return { month, label: monthLabel(month), byModel };
  });
}

/**
 * Average selling price of *delivered* units per month — a mix indicator. Rising ASP with flat
 * units means the group is selling further up the range, which is a different kind of growth from
 * selling more cars, and the two are worth telling apart.
 */
export interface AspPoint {
  month: string;
  label: string;
  units: number;
  aspRupees: number | null;
}

export function computeAspTrend(ctx: AnalyticsContext): AspPoint[] {
  return ctx.dataset.months.map((month) => {
    const delivered = ctx.deliveries.filter((d) => d.deliveryMonth === month);
    return {
      month,
      label: monthLabel(month),
      units: delivered.length,
      aspRupees: mean(delivered.map((d) => d.lead.dealValue)),
    };
  });
}

/**
 * Reading of the matrix — the storytelling layer over the grid.
 *
 * Lives in the analytics layer, not the chart component, for two reasons: it is a pure derivation
 * that Server Components need without pulling in a client module, and keeping it here means the
 * sentence the page prints and the grid the reader sees are computed from the same object on the
 * same render, so they can never disagree.
 */
export function heatmapHighlights(matrix: HeatmapMatrix): {
  hottest: { row: string; col: string; leads: number } | null;
  coldestRated: { row: string; col: string; value: number } | null;
  bestRated: { row: string; col: string; value: number } | null;
} {
  const rated = matrix.cells.filter((c) => c.value !== null && c.leads >= matrix.minSampleForRate);
  const byLeads = [...matrix.cells].sort((a, b) => b.leads - a.leads);
  const labelOf = (key: string, axis: "row" | "col") =>
    (axis === "row" ? matrix.rows : matrix.cols).find((x) => x.key === key)?.label ?? key;

  const hottestCell = byLeads[0];
  const sortedRated = [...rated].sort((a, b) => (a.value as number) - (b.value as number));
  const worst = sortedRated[0];
  const best = sortedRated[sortedRated.length - 1];

  return {
    hottest: hottestCell
      ? {
          row: labelOf(hottestCell.rowKey, "row"),
          col: labelOf(hottestCell.colKey, "col"),
          leads: hottestCell.leads,
        }
      : null,
    coldestRated:
      worst && matrix.metric !== "volume"
        ? {
            row: labelOf(worst.rowKey, "row"),
            col: labelOf(worst.colKey, "col"),
            value: worst.value as number,
          }
        : null,
    bestRated:
      best && matrix.metric !== "volume"
        ? {
            row: labelOf(best.rowKey, "row"),
            col: labelOf(best.colKey, "col"),
            value: best.value as number,
          }
        : null,
  };
}
