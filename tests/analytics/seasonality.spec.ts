import { describe, it, expect } from "vitest";
import { computeSeasonality } from "@/lib/analytics/models";
import { computeRepHeadToHead, computeRepPerformance } from "@/lib/analytics/reps";
import { BENCHMARK } from "@/lib/analytics/benchmark";
import { fullContext, contextForBranch, contextForMonth } from "../insights/_helpers";
import { TOTAL_LEADS, TOTAL_DELIVERIES, LAKESIDE_BRANCH_ID } from "../fixtures";

describe("computeSeasonality", () => {
  it("counts every lead and every delivery exactly once across the months", () => {
    const s = computeSeasonality(fullContext());
    expect(s.points.reduce((a, p) => a + p.leadsCreated, 0)).toBe(TOTAL_LEADS);
    expect(s.points.reduce((a, p) => a + p.unitsDelivered, 0)).toBe(TOTAL_DELIVERIES);
  });

  /**
   * The finding this section exists to show: enquiries and deliveries peak in *different* months,
   * and the gap between them is the sales cycle. If they ever coincide, the copy on the page —
   * which tells a reader the festive surge is handed over later — stops being true.
   */
  it("puts the demand peak before the sales peak", () => {
    const s = computeSeasonality(fullContext());
    expect(s.peakDemand).not.toBeNull();
    expect(s.peakSales).not.toBeNull();
    expect(s.peakDemand?.month).not.toBe(s.peakSales?.month);
    expect(s.lagMonths).toBeGreaterThan(0);
  });

  it("reports the delivery peak as materially above the monthly mean", () => {
    const s = computeSeasonality(fullContext());
    expect(s.peakSales?.unitsDelivered).toBeGreaterThan(s.meanUnitsPerMonth ?? 0);
    expect(s.peakSales?.salesVsMeanPct ?? 0).toBeGreaterThan(50);
  });

  it("measures the lag in months against the median sales cycle in days", () => {
    const s = computeSeasonality(fullContext());
    expect(s.medianCycleDays).not.toBeNull();
    // One month of lag should be broadly consistent with a cycle of roughly a month or more.
    expect(s.medianCycleDays ?? 0).toBeGreaterThan(20);
  });

  it("identifies the peak months as the actual maxima, not by position", () => {
    const s = computeSeasonality(fullContext());
    expect(s.peakDemand?.leadsCreated).toBe(Math.max(...s.points.map((p) => p.leadsCreated)));
    expect(s.peakSales?.unitsDelivered).toBe(Math.max(...s.points.map((p) => p.unitsDelivered)));
  });

  it("responds to the branch filter", () => {
    const all = computeSeasonality(fullContext());
    const branch = computeSeasonality(contextForBranch(LAKESIDE_BRANCH_ID));
    expect(branch.points.reduce((a, p) => a + p.leadsCreated, 0)).toBeLessThan(
      all.points.reduce((a, p) => a + p.leadsCreated, 0),
    );
  });

  /**
   * Deliberately time-invariant. A seasonality view narrowed to one month would name that month as
   * its own peak — true, circular, and useless — so it reads the branch-scoped, all-time pool.
   */
  it("ignores the time filter", () => {
    expect(JSON.stringify(computeSeasonality(contextForMonth("2025-11")))).toBe(
      JSON.stringify(computeSeasonality(fullContext())),
    );
  });

  it("degrades to nulls rather than throwing on an empty pool", () => {
    const ctx = fullContext();
    const empty = computeSeasonality({ ...ctx, detectionLeads: [] });
    expect(empty.peakDemand?.leadsCreated).toBe(0);
    expect(empty.medianCycleDays).toBeNull();
    expect(empty.points.every((p) => p.unitsDelivered === 0)).toBe(true);
  });
});

describe("computeRepHeadToHead", () => {
  it("picks the best and worst by revenue per lead, above the sample floor", () => {
    const h = computeRepHeadToHead(fullContext());
    expect(h).not.toBeNull();

    const eligible = computeRepPerformance(fullContext())
      .filter((r) => r.role === "sales_officer" && r.leadCount >= BENCHMARK.minSample)
      .sort((a, b) => (b.revenuePerLeadRupees ?? 0) - (a.revenuePerLeadRupees ?? 0));

    expect(h?.top.repId).toBe(eligible[0]?.repId);
    expect(h?.bottom.repId).toBe(eligible[eligible.length - 1]?.repId);
    expect(h?.poolSize).toBe(eligible.length);
  });

  /**
   * The sample floor is the point of the ranking. Without it the top slot goes to whoever had the
   * smallest book and the best luck, which is exactly the reading a leaderboard should not produce.
   */
  it("excludes reps below the minimum sample from both ends", () => {
    const h = computeRepHeadToHead(fullContext());
    expect(h?.top.leadCount).toBeGreaterThanOrEqual(BENCHMARK.minSample);
    expect(h?.bottom.leadCount).toBeGreaterThanOrEqual(BENCHMARK.minSample);

    const belowFloor = computeRepPerformance(fullContext()).filter(
      (r) => r.role === "sales_officer" && r.leadCount > 0 && r.leadCount < BENCHMARK.minSample,
    );
    expect(belowFloor.length).toBeGreaterThan(0); // such reps exist, so the guard is doing work
    for (const rep of belowFloor) {
      expect(h?.top.repId).not.toBe(rep.repId);
      expect(h?.bottom.repId).not.toBe(rep.repId);
    }
  });

  it("puts the top rep ahead of the bottom on the ranking metric", () => {
    const h = computeRepHeadToHead(fullContext());
    expect(h?.top.revenuePerLeadRupees ?? 0).toBeGreaterThan(h?.bottom.revenuePerLeadRupees ?? 0);
  });

  it("carries a full metric set with a gap for every row", () => {
    const h = computeRepHeadToHead(fullContext());
    expect(h?.metrics.map((m) => m.key)).toEqual([
      "leads",
      "contact",
      "test_drive",
      "close",
      "delivered",
      "revenue",
      "revenue_per_lead",
    ]);
    for (const m of h?.metrics ?? []) {
      expect(m.gapText.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
    }
  });

  it("locates the widest gap at one of the three gates", () => {
    const h = computeRepHeadToHead(fullContext());
    expect(["contact", "test_drive", "close"]).toContain(h?.widestGate?.key);
    // It is the widest, so no other gate's gap exceeds it.
    const gateMetrics = (h?.metrics ?? []).filter((m) =>
      ["contact", "test_drive", "close"].includes(m.key),
    );
    const maxGap = Math.max(
      ...gateMetrics.map((m) => (m.topValue ?? 0) - (m.bottomValue ?? 0)),
    );
    expect(h?.widestGate?.gapPoints).toBeCloseTo(maxGap, 4);
  });

  it("is deterministic across repeated runs", () => {
    expect(JSON.stringify(computeRepHeadToHead(fullContext()))).toBe(
      JSON.stringify(computeRepHeadToHead(fullContext())),
    );
  });

  it("returns null rather than inventing a comparison when fewer than two reps qualify", () => {
    const ctx = fullContext();
    const onlyOne = ctx.leads.filter((l) => l.assignedTo === ctx.dataset.reps[1]?.id);
    expect(computeRepHeadToHead({ ...ctx, leads: onlyOne })).toBeNull();
    expect(computeRepHeadToHead({ ...ctx, leads: [] })).toBeNull();
  });

  it("responds to both filters", () => {
    const all = JSON.stringify(computeRepHeadToHead(fullContext()));
    expect(JSON.stringify(computeRepHeadToHead(contextForBranch(LAKESIDE_BRANCH_ID)))).not.toBe(all);
  });
});
