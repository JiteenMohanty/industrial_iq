import { describe, it, expect } from "vitest";
import { queryLeads, LEAD_COHORTS } from "@/lib/analytics/leads";
import { fullContext, contextForBranch } from "../insights/_helpers";
import {
  TOTAL_LEADS,
  NEVER_CONTACTED_GROUP,
  TEST_DRIVE_GATE,
  STUCK_ORDERS_ALL,
  LAKESIDE_BRANCH_ID,
  LAKESIDE_NEVER_CONTACTED,
} from "../fixtures";

describe("queryLeads", () => {
  it("returns every lead for the 'all' cohort", () => {
    expect(queryLeads(fullContext(), { cohort: "all" }).rows).toHaveLength(TOTAL_LEADS);
  });

  it("matches the verified counts for each detection cohort", () => {
    const ctx = fullContext();
    expect(queryLeads(ctx, { cohort: "never_contacted" }).rows).toHaveLength(
      NEVER_CONTACTED_GROUP.count,
    );
    expect(queryLeads(ctx, { cohort: "no_test_drive" }).rows).toHaveLength(
      TEST_DRIVE_GATE.noTestDrive,
    );
    expect(queryLeads(ctx, { cohort: "stuck_orders" }).rows).toHaveLength(STUCK_ORDERS_ALL.count);
  });

  /**
   * The guarantee that makes an alert's "view the N leads" link honest: the explorer reads the
   * same branch-scoped, never-time-scoped pool the detection rules read, so the list can never
   * contain fewer records than the alert just counted.
   */
  it("matches the alert feed's scope — branch narrows it, a time window does not", () => {
    const branchCtx = contextForBranch(LAKESIDE_BRANCH_ID);
    expect(queryLeads(branchCtx, { cohort: "never_contacted" }).rows).toHaveLength(
      LAKESIDE_NEVER_CONTACTED,
    );

    const narrowed = {
      ...branchCtx,
      leads: [],
      deliveries: [],
      filters: {
        ...branchCtx.filters,
        from: new Date("2020-01-01"),
        to: new Date("2020-01-02"),
      },
    };
    expect(queryLeads(narrowed, { cohort: "never_contacted" }).rows).toHaveLength(
      LAKESIDE_NEVER_CONTACTED,
    );
  });

  it("honours an explicit evidence id list", () => {
    const ctx = fullContext();
    const ids = queryLeads(ctx, { cohort: "all" }).rows.slice(0, 4).map((r) => r.leadId);
    const result = queryLeads(ctx, { cohort: "all", ids });
    expect(result.rows.map((r) => r.leadId).sort()).toEqual([...ids].sort());
  });

  it("intersects entity filters rather than replacing the cohort", () => {
    const ctx = fullContext();
    const model = ctx.dataset.models[0] as string;
    const rows = queryLeads(ctx, { cohort: "never_contacted", model }).rows;
    expect(rows.every((r) => r.model === model && !r.wasContacted)).toBe(true);
  });

  it("sorts on every key, in both directions, with a total order", () => {
    const ctx = fullContext();
    for (const sort of ["value", "age", "idle", "customer", "stage"] as const) {
      for (const dir of ["asc", "desc"] as const) {
        const a = queryLeads(ctx, { cohort: "all", sort, dir }).rows.map((r) => r.leadId);
        const b = queryLeads(ctx, { cohort: "all", sort, dir }).rows.map((r) => r.leadId);
        expect(a).toEqual(b); // deterministic
        expect(a).toHaveLength(TOTAL_LEADS);
      }
    }
    const desc = queryLeads(ctx, { cohort: "all", sort: "value", dir: "desc" }).rows;
    expect(desc[0]?.dealValueRupees).toBeGreaterThanOrEqual(
      desc[desc.length - 1]?.dealValueRupees ?? 0,
    );
  });

  it("sums the value of exactly the rows it returns", () => {
    const result = queryLeads(fullContext(), { cohort: "never_contacted" });
    expect(result.totalValueRupees).toBe(
      result.rows.reduce((s, r) => s + r.dealValueRupees, 0),
    );
    expect(result.totalValueRupees).toBe(NEVER_CONTACTED_GROUP.valueRupees);
  });

  it("returns an empty list rather than throwing for an impossible combination", () => {
    const result = queryLeads(fullContext(), {
      cohort: "delivered",
      model: "No Such Model",
    });
    expect(result.rows).toEqual([]);
    expect(result.totalValueRupees).toBe(0);
  });

  it("gives every cohort a label and description for the UI to state", () => {
    for (const cohort of LEAD_COHORTS) {
      const result = queryLeads(fullContext(), { cohort: cohort.key });
      expect(result.cohortLabel).toBe(cohort.label);
      expect(result.cohortDescription.length).toBeGreaterThan(0);
    }
  });

  it("partitions leads into delivered, lost and open without overlap or loss", () => {
    const ctx = fullContext();
    const delivered = queryLeads(ctx, { cohort: "delivered" }).rows.length;
    const lost = queryLeads(ctx, { cohort: "lost" }).rows.length;
    const open = queryLeads(ctx, { cohort: "open" }).rows.length;
    expect(delivered + lost + open).toBe(TOTAL_LEADS);
  });
});
