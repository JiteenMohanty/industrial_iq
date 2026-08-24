import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/never-contacted";
import { fullContext } from "./_helpers";
import { LAKESIDE_BRANCH_ID } from "../fixtures";
import { THRESHOLDS } from "@/lib/insights/thresholds";

describe("insight rule: never-contacted", () => {
  it("fires for Lakeside (B3) with exactly the verified 33 never-contacted leads", () => {
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakeside).toBeDefined();
    expect(lakeside?.severity).toBe("critical");
    expect(lakeside?.metric.value).toBe(33);
    expect(lakeside?.evidence.length).toBe(33);
  });

  it("counts lost leads that were never contacted, not just currently-open ones", () => {
    // All 33 of Lakeside's never-contacted leads are already `lost` in this dataset — a strict
    // isOpen gate would make this rule fire zero times anywhere in the group (verified during
    // implementation; see decision-log.md). This is the regression guard for that finding.
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakeside?.metric.value).toBeGreaterThanOrEqual(THRESHOLDS.neverContacted.minLeadsToFire);
    expect(lakeside?.evidence.length).toBe(lakeside?.metric.value);
  });

  it("every emitted insight has non-empty evidence and a populated href (FR-008)", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.href).toMatch(/^\/branches\//);
      expect(insight.id).toBe(`${slug}:${insight.entity.id}`);
    }
  });

  it("evidence lead ids are all open leads that never reached contacted", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThanOrEqual(THRESHOLDS.neverContacted.minLeadsToFire);
    }
  });
});
