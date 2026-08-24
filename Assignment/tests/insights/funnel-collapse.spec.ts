import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/funnel-collapse";
import { fullContext } from "./_helpers";
import { LAKESIDE_BRANCH_ID } from "../fixtures";

describe("insight rule: funnel-collapse", () => {
  it("fires for Lakeside (B3), whose worst gap is at negotiation (~28pp below group)", () => {
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakeside).toBeDefined();
    expect(lakeside?.severity).toBe("warning");
    expect(lakeside?.metric.comparison).not.toBeNull();
    const gap = (lakeside?.metric.comparison ?? 0) - (lakeside?.metric.value ?? 0);
    expect(gap).toBeGreaterThanOrEqual(15);
  });

  it("is silent for every other branch — none has a 15pp gap at any stage", () => {
    const insights = run(fullContext());
    expect(insights).toHaveLength(1);
    expect(insights[0]?.entity.id).toBe(LAKESIDE_BRANCH_ID);
  });

  it("evidence is the leads that failed to reach the collapsing stage", () => {
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakeside?.evidence.length).toBeGreaterThan(0);
    expect(lakeside?.id).toBe(`${slug}:${LAKESIDE_BRANCH_ID}`);
    expect(lakeside?.href).toMatch(/^\/branches\//);
  });
});
