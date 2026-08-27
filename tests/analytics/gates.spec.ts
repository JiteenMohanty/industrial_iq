import { describe, it, expect } from "vitest";
import { computeGates, computeGatesFor, computeBranchGates } from "@/lib/analytics/gates";
import { fullContext } from "../insights/_helpers";
import {
  TEST_DRIVE_GATE,
  PRE_TEST_DRIVE_LOSS,
  NEVER_CONTACTED_GROUP,
  BRANCH_TEST_DRIVE_RATES,
  GROUP_FUNNEL,
  TOTAL_LEADS,
} from "../fixtures";

describe("gate analysis", () => {
  it("reproduces the three gates against the verified group funnel", () => {
    const g = computeGates(fullContext());
    expect(g.totalLeads).toBe(TOTAL_LEADS);

    const [contact, testDrive, close] = g.steps;
    expect(contact?.entered).toBe(GROUP_FUNNEL.new);
    expect(contact?.passed).toBe(GROUP_FUNNEL.contacted);
    expect(contact?.lost).toBe(NEVER_CONTACTED_GROUP.count);

    expect(testDrive?.entered).toBe(GROUP_FUNNEL.contacted);
    expect(testDrive?.passed).toBe(GROUP_FUNNEL.test_drive);
    expect(testDrive?.lost).toBe(TEST_DRIVE_GATE.noTestDrive);

    expect(close?.entered).toBe(GROUP_FUNNEL.test_drive);
    expect(close?.passed).toBe(GROUP_FUNNEL.delivered);
  });

  /**
   * The single most important assertion in this suite. The entire product is framed around the
   * test drive being an absolute gate rather than a probabilistic step; if this ever becomes
   * non-zero, the framing is wrong and the copy across the Overview, funnel and lead explorer all
   * needs revisiting before the fixture is touched.
   */
  it("confirms the test drive is an absolute gate: zero deliveries without one", () => {
    const g = computeGates(fullContext());
    expect(g.noTestDriveCount).toBe(TEST_DRIVE_GATE.noTestDrive);
    expect(g.noTestDriveDelivered).toBe(0);
  });

  it("confirms no lead skips a stage — the funnel is strictly sequential", () => {
    const ctx = fullContext();
    const ORDER = ["new", "contacted", "test_drive", "negotiation", "order_placed", "delivered"];
    for (const lead of ctx.groupLeads) {
      const indices = lead.statusHistory
        .filter((h) => h.status !== "lost")
        .map((h) => ORDER.indexOf(h.status));
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBe((indices[i - 1] as number) + 1);
      }
    }
  });

  it("totals the pre-test-drive loss across both gates", () => {
    const g = computeGates(fullContext());
    expect(g.preTestDriveLost).toBe(PRE_TEST_DRIVE_LOSS.leads);
    expect(g.preTestDriveLostValueRupees).toBe(PRE_TEST_DRIVE_LOSS.valueRupees);
    expect(g.preTestDriveLostSharePct).toBeCloseTo(PRE_TEST_DRIVE_LOSS.sharePct, 1);
  });

  it("carries evidence ids matching the counts it reports", () => {
    const g = computeGates(fullContext());
    expect(g.neverContactedIds).toHaveLength(NEVER_CONTACTED_GROUP.count);
    expect(g.noTestDriveIds).toHaveLength(TEST_DRIVE_GATE.noTestDrive);
    expect(new Set(g.neverContactedIds).size).toBe(g.neverContactedIds.length);
  });

  it("computes per-branch test-drive rates matching the verified figures", () => {
    const rows = computeBranchGates(fullContext());
    for (const [branchId, expected] of Object.entries(BRANCH_TEST_DRIVE_RATES)) {
      const row = rows.find((r) => r.branchId === branchId);
      expect(row?.testDriveRatePct).toBeCloseTo(expected, 1);
    }
  });

  it("returns nulls rather than NaN on an empty lead pool", () => {
    const g = computeGatesFor([]);
    expect(g.totalLeads).toBe(0);
    expect(g.steps[0]?.passRatePct).toBeNull();
    expect(g.steps[1]?.passRatePct).toBeNull();
    expect(g.preTestDriveLostSharePct).toBeNull();
    expect(g.preTestDriveLostValueRupees).toBe(0);
  });

  it("is unaffected by the time filter — a structural fact, not a windowed one", () => {
    const ctx = fullContext();
    const narrowed = {
      ...ctx,
      leads: [],
      deliveries: [],
      filters: { ...ctx.filters, from: new Date("2020-01-01"), to: new Date("2020-01-02") },
    };
    expect(computeGates(narrowed).preTestDriveLost).toBe(PRE_TEST_DRIVE_LOSS.leads);
  });
});
