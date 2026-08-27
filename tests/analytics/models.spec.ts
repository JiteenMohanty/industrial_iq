import { describe, it, expect } from "vitest";
import {
  computeModelPerformance,
  computeInterestMatrix,
  computeModelTrend,
  computeAspTrend,
  heatmapHighlights,
} from "@/lib/analytics/models";
import { fullContext } from "../insights/_helpers";
import { MODEL_PERFORMANCE, TOTAL_MODELS, TOTAL_LEADS, DELIVERED_REVENUE_RUPEES } from "../fixtures";

describe("computeModelPerformance", () => {
  it("reproduces the verified per-model figures", () => {
    const rows = computeModelPerformance(fullContext());
    expect(rows).toHaveLength(TOTAL_MODELS);

    for (const [model, expected] of Object.entries(MODEL_PERFORMANCE)) {
      const row = rows.find((r) => r.model === model);
      expect(row, `missing model ${model}`).toBeDefined();
      expect(row?.leads).toBe(expected.leads);
      expect(row?.delivered).toBe(expected.delivered);
      expect(row?.revenueSharePct).toBeCloseTo(expected.revenueSharePct, 1);
    }
  });

  it("covers every lead and the whole delivered revenue exactly once", () => {
    const rows = computeModelPerformance(fullContext());
    expect(rows.reduce((s, r) => s + r.leads, 0)).toBe(TOTAL_LEADS);
    expect(rows.reduce((s, r) => s + r.revenueRupees, 0)).toBe(DELIVERED_REVENUE_RUPEES);
  });

  it("sorts by revenue descending", () => {
    const rows = computeModelPerformance(fullContext());
    const revenues = rows.map((r) => r.revenueRupees);
    expect([...revenues].sort((a, b) => b - a)).toEqual(revenues);
  });

  /** The mix finding the product leads with: volume rank and revenue rank disagree. */
  it("shows revenue concentrating away from the highest-volume model", () => {
    const rows = computeModelPerformance(fullContext());
    const topRevenue = rows[0];
    const topVolume = [...rows].sort((a, b) => b.leads - a.leads)[0];
    expect(topRevenue?.model).not.toBe(topVolume?.model);
    expect(topRevenue?.revenueSharePct ?? 0).toBeGreaterThan(topVolume?.revenueSharePct ?? 0);
  });
});

describe("computeInterestMatrix", () => {
  it("builds a complete model x branch grid", () => {
    const ctx = fullContext();
    const m = computeInterestMatrix(ctx, "branch", "volume");
    expect(m.rows).toHaveLength(TOTAL_MODELS);
    expect(m.cols).toHaveLength(ctx.dataset.branches.length);
    expect(m.cells).toHaveLength(TOTAL_MODELS * ctx.dataset.branches.length);
    expect(m.cells.reduce((s, c) => s + c.leads, 0)).toBe(TOTAL_LEADS);
  });

  it("supports every dimension without dropping leads", () => {
    const ctx = fullContext();
    for (const dim of ["branch", "source", "month"] as const) {
      const m = computeInterestMatrix(ctx, dim, "volume");
      expect(m.cells.reduce((s, c) => s + c.leads, 0)).toBe(TOTAL_LEADS);
    }
  });

  /**
   * FR-011a's principle applied to a visual: a one-lead cell must not render "100% conversion".
   * Suppression is what stops the heatmap inviting a conclusion the sample cannot support.
   */
  it("suppresses rate values in cells below the minimum sample", () => {
    const m = computeInterestMatrix(fullContext(), "branch", "conversion");
    for (const cell of m.cells) {
      if (cell.leads < m.minSampleForRate) expect(cell.value).toBeNull();
    }
    expect(m.cells.some((c) => c.value === null)).toBe(true);
  });

  it("never suppresses volume, which is meaningful at any count", () => {
    const m = computeInterestMatrix(fullContext(), "branch", "volume");
    expect(m.cells.every((c) => c.value !== null)).toBe(true);
  });

  it("normalises intensity into 0..1 and leaves null cells unfilled", () => {
    for (const metric of ["volume", "conversion", "testDrive"] as const) {
      const m = computeInterestMatrix(fullContext(), "branch", metric);
      for (const cell of m.cells) {
        if (cell.value === null) {
          expect(cell.intensity).toBeNull();
        } else {
          expect(cell.intensity).toBeGreaterThanOrEqual(0);
          expect(cell.intensity).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("derives highlights from the matrix it is given, not from a second pass", () => {
    const m = computeInterestMatrix(fullContext(), "branch", "volume");
    const h = heatmapHighlights(m);
    const maxLeads = Math.max(...m.cells.map((c) => c.leads));
    expect(h.hottest?.leads).toBe(maxLeads);
  });
});

describe("model trends", () => {
  it("counts every lead exactly once across the month trend", () => {
    const ctx = fullContext();
    const trend = computeModelTrend(ctx);
    const total = trend.reduce(
      (s, p) => s + Object.values(p.byModel).reduce((a, b) => a + b, 0),
      0,
    );
    expect(total).toBe(TOTAL_LEADS);
  });

  it("returns a null ASP for months with no deliveries rather than zero", () => {
    const asp = computeAspTrend(fullContext());
    for (const point of asp) {
      if (point.units === 0) expect(point.aspRupees).toBeNull();
      else expect(point.aspRupees).toBeGreaterThan(0);
    }
  });
});
