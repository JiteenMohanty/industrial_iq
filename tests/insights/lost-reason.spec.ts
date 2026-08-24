import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/lost-reason";
import { fullContext } from "./_helpers";

describe("insight rule: lost-reason", () => {
  it("runs without throwing and returns an array", () => {
    const insights = run(fullContext());
    expect(Array.isArray(insights)).toBe(true);
  });

  it("returns [] on this dataset — no branch's top loss reason reaches 40% concentration (max is ~22%)", () => {
    const insights = run(fullContext());
    expect(insights).toHaveLength(0);
  });

  it("structural id/href contract holds if it ever fires", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.id).toBe(`${slug}:${insight.entity.id}`);
      expect(insight.href).toMatch(/^\/branches\//);
    }
  });
});
