import { describe, it, expect } from "vitest";
import { runInsights } from "@/lib/insights/engine";
import { fullContext } from "./_helpers";

describe("insight engine", () => {
  it("ranks a Lakeside (B3) insight first on the unfiltered context — the central finding", () => {
    // never-contacted:B3 and contact-rate:B3 draw from nearly the same evidence population (both
    // ~33 leads that never reached contacted), so they tie on severity and impact; which one wins
    // the id-ascending tiebreak is an implementation detail, not a product requirement — either
    // headline tells the Lakeside story. What matters for SC-001 is that B3 leads.
    const insights = runInsights(fullContext());
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]?.entity.id).toBe("B3");
    expect(insights[0]?.severity).toBe("critical");
  });

  it("produces a total order: severity, then impact descending (null last), then id ascending", () => {
    const insights = runInsights(fullContext());
    const severityRank = { critical: 0, warning: 1, info: 2 } as const;

    for (let i = 1; i < insights.length; i++) {
      const prev = insights[i - 1];
      const curr = insights[i];
      if (!prev || !curr) continue;

      const prevSev = severityRank[prev.severity];
      const currSev = severityRank[curr.severity];
      expect(prevSev).toBeLessThanOrEqual(currSev);

      if (prevSev === currSev) {
        const prevImpact = prev.impactRupees ?? -Infinity;
        const currImpact = curr.impactRupees ?? -Infinity;
        if (prevImpact === currImpact) {
          expect(prev.id <= curr.id).toBe(true);
        } else {
          expect(prevImpact).toBeGreaterThanOrEqual(currImpact);
        }
      }
    }
  });

  it("is fully deterministic: two runs over the same context produce identical id sequences", () => {
    const ctx = fullContext();
    const first = runInsights(ctx).map((i) => i.id);
    const second = runInsights(ctx).map((i) => i.id);
    expect(first).toEqual(second);
  });

  it("every insight has non-empty evidence and a populated href (FR-008)", () => {
    const insights = runInsights(fullContext());
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.href.length).toBeGreaterThan(0);
    }
  });

  it("null impactRupees sorts after every insight with a real rupee figure at the same severity", () => {
    const insights = runInsights(fullContext());
    const bySeverity = new Map<string, typeof insights>();
    for (const insight of insights) {
      const list = bySeverity.get(insight.severity) ?? [];
      list.push(insight);
      bySeverity.set(insight.severity, list);
    }
    for (const group of bySeverity.values()) {
      const firstNullIndex = group.findIndex((i) => i.impactRupees === null);
      if (firstNullIndex === -1) continue;
      for (let i = firstNullIndex + 1; i < group.length; i++) {
        expect(group[i]?.impactRupees).toBeNull();
      }
    }
  });
});
