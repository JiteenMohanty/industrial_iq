import { describe, it, expect } from "vitest";
import { computeFunnel, computeStageDurations, computeLossBreakdown } from "@/lib/analytics/funnel";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { GROUP_FUNNEL, LOSSES_BY_STAGE, TOTAL_LOSSES, LAKESIDE_BRANCH_ID } from "../fixtures";

function fullContext() {
  const dataset = getDataset();
  return buildContext(parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset)));
}

describe("computeFunnel", () => {
  it("reproduces the group funnel by ever-reached stage, not current status", () => {
    const funnel = computeFunnel(fullContext());
    expect(funnel.stages.map((s) => s.count)).toEqual([
      GROUP_FUNNEL.new,
      GROUP_FUNNEL.contacted,
      GROUP_FUNNEL.test_drive,
      GROUP_FUNNEL.negotiation,
      GROUP_FUNNEL.order_placed,
      GROUP_FUNNEL.delivered,
    ]);
  });

  it("computes drop-off percentage between consecutive stages", () => {
    const funnel = computeFunnel(fullContext());
    const contactedStage = funnel.stages.find((s) => s.stage === "contacted");
    expect(contactedStage?.dropOffFromPrevious).toBeCloseTo(
      100 - (GROUP_FUNNEL.contacted / GROUP_FUNNEL.new) * 100,
      1,
    );
  });

  it("a branch-scoped funnel diverges sharply from the group for Lakeside", () => {
    const branchFunnel = computeFunnel(fullContext(), { branchId: LAKESIDE_BRANCH_ID });
    const deliveredStage = branchFunnel.stages.find((s) => s.stage === "delivered");
    expect(deliveredStage?.pctOfTop).toBeCloseTo(7.6, 1);
  });
});

describe("computeStageDurations", () => {
  it("returns a positive average duration for every stage transition", () => {
    const durations = computeStageDurations(fullContext());
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) {
      expect(d.avgDays).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("computeLossBreakdown", () => {
  it("reproduces the status_history-derived loss-by-stage figures exactly", () => {
    const breakdown = computeLossBreakdown(fullContext());
    const byStage = new Map(breakdown.byStage.map((b) => [b.stage, b.count]));
    expect(byStage.get("new")).toBe(LOSSES_BY_STAGE.new);
    expect(byStage.get("contacted")).toBe(LOSSES_BY_STAGE.contacted);
    expect(byStage.get("test_drive")).toBe(LOSSES_BY_STAGE.test_drive);
    expect(byStage.get("negotiation")).toBe(LOSSES_BY_STAGE.negotiation);
    const total = breakdown.byStage.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(TOTAL_LOSSES);
  });

  it("only counts leads whose status_history actually contains a lost entry", () => {
    const breakdown = computeLossBreakdown(fullContext());
    const total = breakdown.byStage.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(274); // not 288 — see decision-log.md
  });

  it("also buckets by lost_reason", () => {
    const breakdown = computeLossBreakdown(fullContext());
    expect(breakdown.byReason.length).toBeGreaterThan(0);
    const total = breakdown.byReason.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(TOTAL_LOSSES);
  });
});
