import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/delay-reason";
import { fullContext } from "./_helpers";

describe("insight rule: delay-reason", () => {
  it("runs without throwing and returns an array", () => {
    const insights = run(fullContext());
    expect(Array.isArray(insights)).toBe(true);
  });

  it("returns [] on this dataset — max branch concentration is 33.3% (Lakeside, below both the 40% floor and the 5-delivery minimum)", () => {
    const insights = run(fullContext());
    expect(insights).toHaveLength(0);
  });

  it("structural id/href contract holds if it ever fires", () => {
    const insights = run(fullContext());
    for (const insight of insights) {
      expect(insight.id).toBe(`${slug}:${insight.entity.id}`);
      expect(insight.href).toContain("/deliveries");
    }
  });
});
