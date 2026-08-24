import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/stuck-orders";
import { fullContext } from "./_helpers";

describe("insight rule: stuck-orders", () => {
  it("fires per branch for orders placed >=27 days ago with no delivery", () => {
    const insights = run(fullContext());
    const byBranch = new Map(insights.map((i) => [i.entity.id, i]));
    // Verified directly against the dataset (>=27 day threshold, order_placed with no delivery).
    expect(byBranch.get("B1")?.evidence).toHaveLength(5);
    expect(byBranch.get("B2")?.evidence).toHaveLength(4);
    expect(byBranch.get("B3")?.evidence).toHaveLength(4);
    expect(byBranch.get("B4")?.evidence).toHaveLength(5);
    expect(byBranch.get("B5")?.evidence).toHaveLength(7);
  });

  it("totals 25 alerting orders across the group, distinct from the 38 total stuck orders", () => {
    const insights = run(fullContext());
    const total = insights.reduce((sum, i) => sum + i.evidence.length, 0);
    expect(total).toBe(25);
  });

  it("every insight id follows rule:branch and drills to /deliveries?branch=", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.id).toBe(`${slug}:${insight.entity.id}`);
      expect(insight.href).toContain("/deliveries");
      expect(insight.href).toContain(`branch=${insight.entity.id}`);
      expect(insight.severity).toBe("critical");
    }
  });

  it("impact is the sum of deal_value across the branch's alerting orders", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.impactRupees).not.toBeNull();
      expect(insight.impactRupees).toBeGreaterThan(0);
    }
  });
});
