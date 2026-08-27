import { describe, it, expect } from "vitest";
import {
  computePromiseReliability,
  computePromiseReliabilityByBranch,
  computeSlipDistribution,
} from "@/lib/analytics/deliveries";
import { fullContext } from "../insights/_helpers";
import { PROMISE_RELIABILITY, BRANCH_LATE_PCT, TOTAL_DELIVERIES } from "../fixtures";

describe("promise reliability", () => {
  it("reproduces the verified group figures", () => {
    const r = computePromiseReliability(fullContext());
    expect(r.delivered).toBe(PROMISE_RELIABILITY.delivered);
    expect(r.late).toBe(PROMISE_RELIABILITY.late);
    expect(r.latePct).toBeCloseTo(PROMISE_RELIABILITY.latePct, 1);
    expect(r.medianSlipDays).toBe(PROMISE_RELIABILITY.medianSlipDays);
  });

  it("splits every delivered unit into exactly one of late or on-time-or-early", () => {
    const r = computePromiseReliability(fullContext());
    expect(r.late + r.onTimeOrEarly).toBe(TOTAL_DELIVERIES);
  });

  it("reproduces per-branch late rates", () => {
    const rows = computePromiseReliabilityByBranch(fullContext());
    for (const [branchId, expected] of Object.entries(BRANCH_LATE_PCT)) {
      expect(rows.find((r) => r.branchId === branchId)?.latePct).toBeCloseTo(expected, 1);
    }
  });

  /**
   * The finding worth protecting: reliability does not track revenue. The highest-earning branch
   * is also the least reliable, which is invisible to any units-and-revenue view.
   */
  it("shows the top-revenue branch is not the most reliable one", () => {
    const ctx = fullContext();
    const revenueByBranch = new Map(
      ctx.dataset.branches.map((b) => [
        b.id,
        ctx.groupDeliveries
          .filter((d) => d.lead.branchId === b.id)
          .reduce((s, d) => s + d.lead.dealValue, 0),
      ]),
    );
    const topRevenueBranch = [...revenueByBranch.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const rows = computePromiseReliabilityByBranch(ctx);
    const worst = [...rows].sort((a, b) => (b.latePct ?? 0) - (a.latePct ?? 0))[0];
    expect(worst?.branchId).toBe(topRevenueBranch);
  });

  it("buckets every delivered unit exactly once in the slip distribution", () => {
    const buckets = computeSlipDistribution(fullContext());
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(TOTAL_DELIVERIES);
  });
});
