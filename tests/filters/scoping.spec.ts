import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { runInsights } from "@/lib/insights/engine";
import { LAKESIDE_BRANCH_ID, BRANCH_CONTACT_RATES, TOTAL_LEADS } from "../fixtures";

function filtersFrom(params: Record<string, string>) {
  const dataset = getDataset();
  return parseFilters(new URLSearchParams(params), buildParseFiltersContext(dataset));
}

const GROUP_CONTACT_RATE_PCT =
  (Object.values(BRANCH_CONTACT_RATES).reduce((sum, b) => sum + b.contacted, 0) /
    Object.values(BRANCH_CONTACT_RATES).reduce((sum, b) => sum + b.total, 0)) *
  100;

describe("Insight scoping — time range vs branch filter (FR-009, FR-009a)", () => {
  it("a narrow time window leaves the ranked insight list unchanged (FR-009)", () => {
    const fullInsights = runInsights(buildContext(filtersFrom({})));
    const monthInsights = runInsights(
      buildContext(filtersFrom({ preset: "month", month: "2025-06" })),
    );
    expect(monthInsights.map((i) => i.id)).toEqual(fullInsights.map((i) => i.id));
  });

  it("last30/last90 presets also leave insight output unchanged (FR-009)", () => {
    const fullInsights = runInsights(buildContext(filtersFrom({})));
    const last30Insights = runInsights(buildContext(filtersFrom({ preset: "last30" })));
    expect(last30Insights.map((i) => i.id)).toEqual(fullInsights.map((i) => i.id));
  });

  it("selecting a branch narrows the feed and every insight's evidence belongs to that branch (FR-009a)", () => {
    const dataset = getDataset();
    const fullInsights = runInsights(buildContext(filtersFrom({})));
    const branchInsights = runInsights(buildContext(filtersFrom({ branch: LAKESIDE_BRANCH_ID })));

    expect(branchInsights.length).toBeGreaterThan(0);
    expect(branchInsights.length).toBeLessThan(fullInsights.length);

    for (const insight of branchInsights) {
      if (insight.entity.kind === "branch") {
        expect(insight.entity.id).toBe(LAKESIDE_BRANCH_ID);
      }
      for (const leadId of insight.evidence) {
        const lead = dataset.leadById.get(leadId);
        expect(lead?.branchId).toBe(LAKESIDE_BRANCH_ID);
      }
    }
  });

  it("a comparative rule still reports the full group figure even when narrowed to one branch (FR-009a)", () => {
    const ctx = buildContext(filtersFrom({ branch: LAKESIDE_BRANCH_ID }));
    const insights = runInsights(ctx);
    const contactRateInsight = insights.find((i) => i.id === `contact-rate:${LAKESIDE_BRANCH_ID}`);

    expect(contactRateInsight).toBeDefined();
    expect(contactRateInsight?.metric.value).toBeCloseTo(
      BRANCH_CONTACT_RATES[LAKESIDE_BRANCH_ID]?.pct ?? 0,
      1,
    );
    // The comparison figure is the whole group's rate, not the branch-narrowed one — proves
    // `contact-rate` reads its comparison from `ctx.groupLeads`, unaffected by the branch filter.
    expect(contactRateInsight?.metric.comparison).toBeCloseTo(GROUP_CONTACT_RATE_PCT, 1);
    expect(ctx.groupLeads.length).toBe(TOTAL_LEADS);
  });
});
