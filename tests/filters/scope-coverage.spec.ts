import { describe, it, expect } from "vitest";
import { fullContext, contextForBranch, contextForMonth } from "../insights/_helpers";
import type { AnalyticsContext } from "@/lib/analytics/context";

import { computeKpis } from "@/lib/analytics/kpis";
import { computeFunnel, computeStageDurations, computeLossBreakdown } from "@/lib/analytics/funnel";
import { computeGates, computeBranchGates } from "@/lib/analytics/gates";
import { computeModelPerformance, computeInterestMatrix } from "@/lib/analytics/models";
import { computeSourcePerformance, computeChannelPerformance } from "@/lib/analytics/sources";
import { computeRepPerformance } from "@/lib/analytics/reps";
import {
  computeDeliveryOps,
  computeDelayReasons,
  computePromiseReliability,
  computePromiseReliabilityByBranch,
  computeDeliveryByBranch,
} from "@/lib/analytics/deliveries";
import { computeStuckOrders } from "@/lib/analytics/pipeline";
import { computeRevenueTrend } from "@/lib/analytics/trends";
import { queryLeads } from "@/lib/analytics/leads";
import { runInsights } from "@/lib/insights/engine";
import { LAKESIDE_BRANCH_ID } from "../fixtures";

/**
 * The filter bar is global, so every analytics function has to have a *deliberate* answer to
 * "does this respond to the branch filter, and to the time filter?".
 *
 * This suite exists because the honest answer used to be "mostly no, by accident". Nearly every
 * function read the unfiltered group pool, so the shared Time range / Branch controls were inert
 * on five of eight pages — a control that silently does nothing is worse than one that isn't
 * there. The table below is the contract; each row is asserted in both directions, so a function
 * that quietly stops responding, or starts responding when it must not, fails here.
 *
 * The `false` entries are as important as the `true` ones:
 *   - Alerts, gates, stuck orders and the lead explorer ignore the time filter by design (FR-009).
 *     A live problem must not vanish because someone chose "last 30 days".
 *   - Cross-branch comparison tables ignore the branch filter by design. They exist to rank every
 *     branch; filtering them to one row destroys the only thing they do.
 */
const MONTH = "2025-11";
const OTHER_MONTH = "2025-09";

interface ScopeCase {
  name: string;
  run: (ctx: AnalyticsContext) => unknown;
  branch: boolean;
  time: boolean;
  why?: string;
}

const CASES: ScopeCase[] = [
  // --- population views: both filters apply ---------------------------------
  { name: "computeKpis", run: computeKpis, branch: true, time: true },
  { name: "computeFunnel", run: (c) => computeFunnel(c), branch: true, time: true },
  { name: "computeStageDurations", run: computeStageDurations, branch: true, time: true },
  { name: "computeLossBreakdown", run: computeLossBreakdown, branch: true, time: true },
  { name: "computeModelPerformance", run: computeModelPerformance, branch: true, time: true },
  {
    name: "computeInterestMatrix",
    run: (c) => computeInterestMatrix(c, "branch", "volume"),
    branch: true,
    time: true,
  },
  { name: "computeSourcePerformance", run: computeSourcePerformance, branch: true, time: true },
  { name: "computeRepPerformance", run: computeRepPerformance, branch: true, time: true },
  { name: "computeDeliveryOps", run: computeDeliveryOps, branch: true, time: true },
  { name: "computeDelayReasons", run: computeDelayReasons, branch: true, time: true },
  { name: "computePromiseReliability", run: computePromiseReliability, branch: true, time: true },
  { name: "computeRevenueTrend", run: computeRevenueTrend, branch: true, time: true },

  // --- present-tense state: branch only, never time (FR-009) ----------------
  {
    name: "runInsights",
    run: runInsights,
    branch: true,
    time: false,
    why: "an alert must not disappear because a narrow window was selected",
  },
  {
    name: "computeGates",
    run: computeGates,
    branch: true,
    time: false,
    why: "the gate leak is structural; a window must not make it look smaller than it is",
  },
  {
    name: "computeStuckOrders",
    run: computeStuckOrders,
    branch: true,
    time: false,
    why: "an order stuck for 195 days is stuck regardless of the selected period",
  },
  {
    name: "queryLeads",
    run: (c) => queryLeads(c, { cohort: "never_contacted" }),
    branch: true,
    time: false,
    why: "must match the alert scope exactly, or an evidence link shows fewer rows than its alert claimed",
  },
  {
    name: "computeChannelPerformance",
    run: computeChannelPerformance,
    branch: true,
    time: false,
    why: "feeds the channel-quality detection rule, which is subject to FR-009",
  },

  // --- cross-branch comparison tables: time only, never branch --------------
  {
    name: "computeBranchGates",
    run: computeBranchGates,
    branch: false,
    time: true,
    why: "exists to rank every branch; filtering to one row destroys it",
  },
  {
    name: "computeDeliveryByBranch",
    run: computeDeliveryByBranch,
    branch: false,
    time: true,
    why: "exists to rank every branch",
  },
  {
    name: "computePromiseReliabilityByBranch",
    run: computePromiseReliabilityByBranch,
    branch: false,
    time: true,
    why: "exists to rank every branch",
  },
];

/**
 * Compares the *substance* of a result, ignoring any embedded href.
 *
 * Drill-through links deliberately carry the reader's filter state (FR-029), so an insight's
 * `href` legitimately differs between two contexts even when the alert itself is identical.
 * Comparing raw JSON would therefore report every rule as "time-scoped" for the wrong reason.
 * Link behaviour is asserted separately below.
 */
const json = (v: unknown) =>
  JSON.stringify(v, (key, value) =>
    key === "href" || key === "evidenceHref" ? undefined : value,
  );

describe("filter scope coverage", () => {
  describe.each(CASES)("$name", (c) => {
    it(
      c.branch
        ? "responds to the branch filter"
        : `ignores the branch filter${c.why ? ` — ${c.why}` : ""}`,
      () => {
        const all = json(c.run(fullContext()));
        const branch = json(c.run(contextForBranch(LAKESIDE_BRANCH_ID)));
        if (c.branch) expect(branch).not.toBe(all);
        else expect(branch).toBe(all);
      },
    );

    it(
      c.time
        ? "responds to the time filter"
        : `ignores the time filter${c.why ? ` — ${c.why}` : ""}`,
      () => {
        const all = json(c.run(fullContext()));
        const month = json(c.run(contextForMonth(MONTH)));
        if (c.time) expect(month).not.toBe(all);
        else expect(month).toBe(all);
      },
    );

    if (c.time) {
      it("distinguishes one month from another", () => {
        expect(json(c.run(contextForMonth(MONTH)))).not.toBe(
          json(c.run(contextForMonth(OTHER_MONTH))),
        );
      });
    }
  });
});

describe("drill-through links carry filter state (FR-029)", () => {
  it("an alert is identical under a time filter, but its links are not", () => {
    const all = runInsights(fullContext());
    const month = runInsights(contextForMonth(MONTH));

    // Same alerts, in the same order, with the same evidence.
    expect(month.map((i) => i.id)).toEqual(all.map((i) => i.id));
    expect(month.map((i) => i.impactRupees)).toEqual(all.map((i) => i.impactRupees));
    expect(month.map((i) => i.evidence)).toEqual(all.map((i) => i.evidence));

    // But the links preserve the window the reader is in, so a drill-through does not lose it.
    expect(month[0]?.href).toContain(MONTH);
    expect(all[0]?.href).not.toContain(MONTH);
  });
});

describe("filtered views stay coherent", () => {
  it("a branch-scoped funnel counts only that branch's leads", () => {
    const ctx = contextForBranch(LAKESIDE_BRANCH_ID);
    const branchLeadCount = ctx.dataset.leadsByBranch.get(LAKESIDE_BRANCH_ID)?.length ?? 0;
    expect(computeFunnel(ctx).stages[0]?.count).toBe(branchLeadCount);
  });

  it("a branch overlay is measured against all branches, not against itself", () => {
    const ctx = contextForBranch(LAKESIDE_BRANCH_ID);
    const baseline = computeFunnel(ctx, { pool: "window" });
    const overlay = computeFunnel(ctx, { branchId: LAKESIDE_BRANCH_ID });
    expect(baseline.stages[0]?.count).toBe(ctx.dataset.leads.length);
    expect(overlay.stages[0]?.count).toBeLessThan(baseline.stages[0]?.count ?? 0);
  });

  it("source shares sum to 100% of whatever scope is selected", () => {
    for (const ctx of [fullContext(), contextForBranch(LAKESIDE_BRANCH_ID), contextForMonth(MONTH)]) {
      const rows = computeSourcePerformance(ctx);
      const leads = rows.reduce((s, r) => s + r.totalLeads, 0);
      expect(leads).toBe(ctx.leads.length);
      const share = rows.reduce((s, r) => s + (r.volumeSharePct ?? 0), 0);
      if (leads > 0) expect(share).toBeCloseTo(100, 6);
    }
  });

  it("model performance covers every lead in scope, exactly once", () => {
    for (const ctx of [fullContext(), contextForBranch(LAKESIDE_BRANCH_ID), contextForMonth(MONTH)]) {
      expect(computeModelPerformance(ctx).reduce((s, m) => s + m.leads, 0)).toBe(ctx.leads.length);
    }
  });

  it("returns empty rather than throwing when a filter combination matches nothing", () => {
    const ctx = contextFor0Leads();
    expect(() => computeModelPerformance(ctx)).not.toThrow();
    expect(() => computeSourcePerformance(ctx)).not.toThrow();
    expect(() => computeFunnel(ctx)).not.toThrow();
    expect(computeFunnel(ctx).stages[0]?.count).toBe(0);
    expect(computeKpis(ctx).conversionRate.value).toBeNull();
  });
});

/** A window entirely outside the data's coverage — the zero-result case (SC-006). */
function contextFor0Leads(): AnalyticsContext {
  const ctx = fullContext();
  return {
    ...ctx,
    leads: [],
    deliveries: [],
    windowLeads: [],
    windowDeliveries: [],
  };
}
