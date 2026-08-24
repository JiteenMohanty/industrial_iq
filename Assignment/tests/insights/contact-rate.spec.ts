import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/contact-rate";
import { fullContext } from "./_helpers";
import { LAKESIDE_BRANCH_ID, BRANCH_CONTACT_RATES } from "../fixtures";

describe("insight rule: contact-rate", () => {
  it("fires for Lakeside (B3) at its verified 58.2% contact rate", () => {
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakeside).toBeDefined();
    expect(lakeside?.metric.value).toBeCloseTo(58.2, 1);
    expect(lakeside?.severity).toBe("critical");
    expect(lakeside?.id).toBe(`${slug}:${LAKESIDE_BRANCH_ID}`);
  });

  it("is silent for every other branch (all clear the 70% floor)", () => {
    const insights = run(fullContext());
    const otherBranches = Object.keys(BRANCH_CONTACT_RATES).filter((b) => b !== LAKESIDE_BRANCH_ID);
    for (const branchId of otherBranches) {
      expect(insights.some((i) => i.entity.id === branchId)).toBe(false);
    }
    expect(insights).toHaveLength(1);
  });

  it("carries the group average as its comparison figure", () => {
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakeside?.metric.comparison).not.toBeNull();
    expect(lakeside?.metric.comparison).toBeGreaterThan(70);
  });

  it("evidence lists exactly the uncontacted leads at the branch", () => {
    const insights = run(fullContext());
    const lakeside = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    const expectedUncontacted = 79 - 46;
    expect(lakeside?.evidence).toHaveLength(expectedUncontacted);
  });
});
