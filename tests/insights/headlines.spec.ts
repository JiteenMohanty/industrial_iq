import { describe, it, expect } from "vitest";
import { runInsights, selectHeadlines } from "@/lib/insights/engine";
import { fullContext } from "./_helpers";

describe("selectHeadlines", () => {
  /**
   * The behaviour this function exists for. Slicing the raw ranking produced a landing feed where
   * four of five cards were the same rule fired at four different branches — strictly the most
   * severe items, and close to useless as a summary of what is wrong with the business.
   */
  it("spends its slots on distinct problem types rather than repeating one rule", () => {
    const all = runInsights(fullContext());
    const naive = all.slice(0, 5);
    const chosen = selectHeadlines(all, 5);

    expect(new Set(naive.map((i) => i.rule)).size).toBeLessThan(5);
    expect(new Set(chosen.map((i) => i.rule)).size).toBe(5);
  });

  it("leads with the most severe item overall", () => {
    const all = runInsights(fullContext());
    expect(selectHeadlines(all, 5)[0]?.id).toBe(all[0]?.id);
  });

  it("picks each rule's own best instance first", () => {
    const all = runInsights(fullContext());
    const chosen = selectHeadlines(all, 5);
    for (const insight of chosen) {
      const bestOfRule = all.find((i) => i.rule === insight.rule);
      expect(insight.id).toBe(bestOfRule?.id);
    }
  });

  it("is deterministic across repeated runs (FR-010)", () => {
    const all = runInsights(fullContext());
    expect(selectHeadlines(all, 5).map((i) => i.id)).toEqual(
      selectHeadlines(all, 5).map((i) => i.id),
    );
  });

  it("never returns more than the limit, and degrades safely on small inputs", () => {
    const all = runInsights(fullContext());
    expect(selectHeadlines(all, 5)).toHaveLength(5);
    expect(selectHeadlines([], 5)).toHaveLength(0);
    expect(selectHeadlines(all.slice(0, 2), 5)).toHaveLength(2);
  });

  it("falls back to further instances of a rule once every rule is represented", () => {
    const all = runInsights(fullContext());
    const ruleCount = new Set(all.map((i) => i.rule)).size;
    const chosen = selectHeadlines(all, ruleCount + 2);
    expect(chosen).toHaveLength(ruleCount + 2);
    expect(new Set(chosen.map((i) => i.id)).size).toBe(chosen.length);
  });

  it("every alert it returns can be drilled into (FR-008)", () => {
    for (const insight of selectHeadlines(runInsights(fullContext()), 5)) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.evidenceHref).toContain("/leads");
      expect(insight.href).toMatch(/^\//);
      expect(insight.action.length).toBeGreaterThan(0);
    }
  });
});
