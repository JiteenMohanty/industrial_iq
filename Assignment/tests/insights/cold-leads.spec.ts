import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/cold-leads";
import { fullContext } from "./_helpers";

describe("insight rule: cold-leads", () => {
  it("fires per branch with the worst severity tier present among its cold leads", () => {
    const insights = run(fullContext());
    const byBranch = new Map(insights.map((i) => [i.entity.id, i]));
    // Verified: every branch has at least one lead stale >=30 days, so every branch's insight
    // is critical severity even though individual leads within it span all three tiers.
    for (const branchId of ["B1", "B2", "B3", "B4", "B5"]) {
      expect(byBranch.get(branchId)?.severity).toBe("critical");
    }
  });

  it("evidence totals 42 cold leads (>=7 days no activity) across the group", () => {
    // 39 among leads whose raw `status` field is trustworthy, plus 3 more from the 14 leads
    // whose raw status says "lost" with no corresponding status_history entry — those are
    // correctly open (Constitution III), and 3 of the 14 happen to also be stale >=7 days.
    const insights = run(fullContext());
    const total = insights.reduce((sum, i) => sum + i.evidence.length, 0);
    expect(total).toBe(42);
  });

  it("every evidence lead is open with daysSinceActivity >= 7", () => {
    const dataset = fullContext().dataset;
    const insights = run(fullContext());
    for (const insight of insights) {
      for (const leadId of insight.evidence) {
        const lead = dataset.leadById.get(leadId);
        expect(lead).toBeDefined();
        expect(lead?.isOpen).toBe(true);
        expect(lead?.daysSinceActivity).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("drills through to the branch detail page", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.id).toBe(`${slug}:${insight.entity.id}`);
      expect(insight.href).toMatch(/^\/branches\//);
    }
  });
});
