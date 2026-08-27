import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/promise-reliability";
import { THRESHOLDS } from "@/lib/insights/thresholds";
import { fullContext } from "./_helpers";
import { BRANCH_LATE_PCT } from "../fixtures";

describe("insight rule: promise-reliability", () => {
  it("fires only for branches above the late-delivery floor", () => {
    const insights = run(fullContext());
    const expected = Object.entries(BRANCH_LATE_PCT).filter(
      ([, pct]) => pct >= THRESHOLDS.promiseReliability.latePctFloor,
    );
    expect(insights).toHaveLength(expected.length);
    for (const [branchId] of expected) {
      expect(insights.some((i) => i.id === `${slug}:${branchId}`)).toBe(true);
    }
  });

  it("excludes branches below the minimum delivered sample entirely (FR-011a)", () => {
    const ctx = fullContext();
    const insights = run(ctx);
    for (const insight of insights) {
      const delivered = ctx.groupLeads.filter(
        (l) => l.branchId === insight.entity.id && l.closeSlipDays !== null,
      );
      expect(delivered.length).toBeGreaterThanOrEqual(THRESHOLDS.promiseReliability.minSample);
    }
  });

  /**
   * The rule deliberately attaches no rupee figure: the revenue is already banked and the cost —
   * lost repeat business — is not something this dataset can price. Inventing one would be exactly
   * the fabricated number the constitution forbids.
   */
  it("carries a null impact rather than an invented rupee figure", () => {
    for (const insight of run(fullContext())) {
      expect(insight.impactRupees).toBeNull();
      expect(insight.severity).toBe("warning");
    }
  });

  it("states the floor and the group figure it is measured against", () => {
    const insight = run(fullContext())[0];
    expect(insight?.body).toContain(String(THRESHOLDS.promiseReliability.latePctFloor));
    expect(insight?.metric.comparison).not.toBeNull();
  });
});
