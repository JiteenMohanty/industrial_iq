import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/test-drive-gate";
import { THRESHOLDS } from "@/lib/insights/thresholds";
import { fullContext, contextForBranch } from "./_helpers";
import { BRANCH_TEST_DRIVE_RATES, LAKESIDE_BRANCH_ID } from "../fixtures";

describe("insight rule: test-drive-gate", () => {
  it("fires for Lakeside (B3) alone — the only branch below the 70% floor", () => {
    const insights = run(fullContext());
    expect(insights).toHaveLength(1);
    expect(insights[0]?.id).toBe(`${slug}:${LAKESIDE_BRANCH_ID}`);
    expect(insights[0]?.severity).toBe("critical");
  });

  it("is silent for the four branches that clear the floor", () => {
    const insights = run(fullContext());
    for (const [branchId, ratePct] of Object.entries(BRANCH_TEST_DRIVE_RATES)) {
      if (ratePct >= THRESHOLDS.testDriveGate.floorPct) {
        expect(insights.some((i) => i.entity.id === branchId)).toBe(false);
      }
    }
  });

  it("reports the branch's actual rate against the group figure", () => {
    const insight = run(fullContext())[0];
    expect(insight?.metric.value).toBeCloseTo(
      BRANCH_TEST_DRIVE_RATES[LAKESIDE_BRANCH_ID] as number,
      1,
    );
    // The comparison is the group rate, so the alert stays readable in a branch-narrowed view.
    expect(insight?.metric.comparison).toBeGreaterThan(insight?.metric.value ?? 0);
  });

  it("keeps the group comparison when the feed is narrowed to that branch (FR-009a)", () => {
    const insight = run(contextForBranch(LAKESIDE_BRANCH_ID))[0];
    expect(insight).toBeDefined();
    expect(insight?.metric.comparison).toBeCloseTo(
      run(fullContext())[0]?.metric.comparison as number,
      1,
    );
  });

  it("carries as evidence exactly the leads it counted, and links them", () => {
    const insight = run(fullContext())[0];
    const ctx = fullContext();
    const stalled = ctx.groupLeads.filter(
      (l) => l.branchId === LAKESIDE_BRANCH_ID && l.wasContacted && !l.tookTestDrive,
    );
    expect(insight?.evidence).toHaveLength(stalled.length);
    expect(insight?.evidenceHref).toContain("cohort=no_test_drive");
    expect(insight?.evidenceHref).toContain(`branch=${LAKESIDE_BRANCH_ID}`);
  });

  it("states the threshold it breached, so the alert is not taken on trust (FR-011)", () => {
    const insight = run(fullContext())[0];
    expect(insight?.body).toContain(String(THRESHOLDS.testDriveGate.floorPct));
  });
});
