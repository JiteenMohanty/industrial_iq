import { describe, it, expect } from "vitest";
import { computeRepPerformance, computeRepDetail } from "@/lib/analytics/reps";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import {
  REP_TOP_DELIVERED,
  REP_WITH_ZERO_LEADS_ID,
  REPS_WITH_ZERO_LEADS_IDS,
  TOTAL_REPS,
} from "../fixtures";

function fullContext() {
  const dataset = getDataset();
  return buildContext(parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset)));
}

describe("computeRepPerformance", () => {
  it("returns exactly one row per rep", () => {
    const rows = computeRepPerformance(fullContext());
    expect(rows).toHaveLength(TOTAL_REPS);
  });

  it("ranks the highest-delivering rep first", () => {
    const rows = computeRepPerformance(fullContext());
    const top = rows[0];
    expect(top?.repId).toBe(REP_TOP_DELIVERED.id);
    expect(top?.deliveredCount).toBe(REP_TOP_DELIVERED.delivered);
    expect(top?.leadCount).toBe(REP_TOP_DELIVERED.leadCount);
    expect(top?.conversionPct).toBeCloseTo(REP_TOP_DELIVERED.conversionPct, 1);
  });

  it("returns null conversionPct for a rep with zero assigned leads, never NaN or 0", () => {
    const rows = computeRepPerformance(fullContext());
    for (const id of REPS_WITH_ZERO_LEADS_IDS) {
      const row = rows.find((r) => r.repId === id);
      expect(row?.leadCount).toBe(0);
      expect(row?.deliveredCount).toBe(0);
      expect(row?.conversionPct).toBeNull();
    }
  });
});

describe("computeRepDetail", () => {
  it("returns null for an unknown rep id rather than throwing", () => {
    const detail = computeRepDetail(fullContext(), "SR-does-not-exist");
    expect(detail).toBeNull();
  });

  it("matches the top-delivering rep's known figures and lists every assigned lead", () => {
    const detail = computeRepDetail(fullContext(), REP_TOP_DELIVERED.id);
    expect(detail).not.toBeNull();
    expect(detail?.repName).toBe(REP_TOP_DELIVERED.name);
    expect(detail?.branchId).toBe(REP_TOP_DELIVERED.branchId);
    expect(detail?.leadCount).toBe(REP_TOP_DELIVERED.leadCount);
    expect(detail?.deliveredCount).toBe(REP_TOP_DELIVERED.delivered);
    expect(detail?.assignedLeads).toHaveLength(REP_TOP_DELIVERED.leadCount);
  });

  it("returns a null conversionPct and an empty lead list for a rep with zero assigned leads", () => {
    const detail = computeRepDetail(fullContext(), REP_WITH_ZERO_LEADS_ID);
    expect(detail).not.toBeNull();
    expect(detail?.leadCount).toBe(0);
    expect(detail?.conversionPct).toBeNull();
    expect(detail?.assignedLeads).toHaveLength(0);
  });

  it("sorts assigned leads oldest first", () => {
    const detail = computeRepDetail(fullContext(), REP_TOP_DELIVERED.id);
    const leads = detail?.assignedLeads ?? [];
    for (let i = 1; i < leads.length; i++) {
      const prev = leads[i - 1];
      const curr = leads[i];
      if (!prev || !curr) continue;
      expect(prev.ageDays).toBeGreaterThanOrEqual(curr.ageDays);
    }
  });
});
