import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { TOTAL_LEADS, LAKESIDE_BRANCH_ID } from "../fixtures";

function filtersFrom(params: Record<string, string>) {
  const dataset = getDataset();
  return parseFilters(new URLSearchParams(params), buildParseFiltersContext(dataset));
}

describe("AnalyticsContext — the three scopes stay distinct (ADR-0005)", () => {
  it("detectionLeads ignores the time range: a narrow month window doesn't shrink it", () => {
    const fullCtx = buildContext(filtersFrom({}));
    const monthCtx = buildContext(filtersFrom({ preset: "month", month: "2025-06" }));

    expect(monthCtx.detectionLeads.length).toBe(fullCtx.detectionLeads.length);
    expect(monthCtx.detectionLeads.length).toBe(TOTAL_LEADS);

    // But the window-scoped `leads` DID shrink to the narrow month.
    expect(monthCtx.leads.length).toBeLessThan(fullCtx.leads.length);
  });

  it("detectionLeads respects the branch filter", () => {
    const ctx = buildContext(filtersFrom({ branch: LAKESIDE_BRANCH_ID }));
    expect(ctx.detectionLeads.length).toBeGreaterThan(0);
    expect(ctx.detectionLeads.every((l) => l.branchId === LAKESIDE_BRANCH_ID)).toBe(true);
    expect(ctx.detectionLeads.length).toBeLessThan(TOTAL_LEADS);
  });

  it("groupLeads is never branch-filtered, even when the branch filter is set", () => {
    const branchCtx = buildContext(filtersFrom({ branch: LAKESIDE_BRANCH_ID }));
    expect(branchCtx.groupLeads.length).toBe(TOTAL_LEADS);
  });

  it("leads (window-scoped) respects both time range and branch filter simultaneously", () => {
    const ctx = buildContext(
      filtersFrom({ preset: "month", month: "2025-06", branch: LAKESIDE_BRANCH_ID }),
    );
    expect(ctx.leads.every((l) => l.branchId === LAKESIDE_BRANCH_ID)).toBe(true);
    expect(ctx.leads.every((l) => l.createdAt >= ctx.filters.from && l.createdAt <= ctx.filters.to)).toBe(
      true,
    );
  });

  it("leads filter on created_at; deliveries filter on delivery_date (FR-030)", () => {
    const ctx = buildContext(filtersFrom({ preset: "month", month: "2025-12" }));
    for (const lead of ctx.leads) {
      expect(lead.createdAt.getUTCMonth()).toBe(11); // December
    }
    for (const delivery of ctx.deliveries) {
      expect(delivery.deliveryDate.getUTCMonth()).toBe(11);
    }
  });

  it("hasPriorPeriod is false when the preceding window falls outside data coverage", () => {
    const ctx = buildContext(filtersFrom({})); // full range — nothing precedes it
    expect(ctx.hasPriorPeriod).toBe(false);
    expect(ctx.priorLeads).toHaveLength(0);
  });

  it("hasPriorPeriod is true when a valid preceding window exists", () => {
    const ctx = buildContext(filtersFrom({ preset: "month", month: "2025-12" }));
    expect(ctx.hasPriorPeriod).toBe(true);
    expect(ctx.priorLeads.length).toBeGreaterThan(0);
  });

  it("asOf equals the dataset's DATA_AS_OF", () => {
    const ctx = buildContext(filtersFrom({}));
    expect(ctx.asOf).toEqual(getDataset().dataAsOf);
  });
});
