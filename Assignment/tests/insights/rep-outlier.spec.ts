import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/rep-outlier";
import { fullContext } from "./_helpers";

describe("insight rule: rep-outlier", () => {
  it("runs without throwing and returns an array", () => {
    const insights = run(fullContext());
    expect(Array.isArray(insights)).toBe(true);
  });

  it("returns [] on this dataset — verified: no rep's rate falls 15pp below their branch's, Lakeside's reps are uniformly poor rather than one outlier dragging the average", () => {
    const insights = run(fullContext());
    expect(insights).toHaveLength(0);
  });

  it("excludes reps below the 15-lead minimum sample entirely, never with a caveat (FR-011a)", () => {
    const dataset = fullContext().dataset;
    const smallSampleReps = dataset.reps.filter(
      (r) => (dataset.leadsByRep.get(r.id) ?? []).length < 15,
    );
    expect(smallSampleReps.length).toBeGreaterThan(0); // sanity: such reps exist
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(smallSampleReps.some((r) => r.id === insight.entity.id)).toBe(false);
    }
  });

  it("every id would follow rule:rep and drill to /reps/ if it ever fires", () => {
    // Structural check on the id/href contract, independent of whether this dataset fires it.
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.id).toBe(`${slug}:${insight.entity.id}`);
      expect(insight.href).toMatch(/^\/reps\//);
    }
  });
});
