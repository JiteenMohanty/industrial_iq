import type { AnalyticsContext } from "@/lib/analytics/context";
import { FUNNEL_STAGES, type Stage } from "@/lib/data/types";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch } from "../helpers";

export const slug = "funnel-collapse" as const;

function reachRatePct(leads: readonly { reachedStages: ReadonlySet<Stage> }[], stage: Stage): number {
  if (leads.length === 0) return 0;
  const reached = leads.filter((l) => l.reachedStages.has(stage)).length;
  return (reached / leads.length) * 100;
}

/**
 * A branch's stage-conversion rate falling >=15pp below the group's rate at that same stage
 * (FR-011 rule 5). One insight per branch, citing the single stage with the largest gap — Lakeside
 * fails at every stage in this dataset, so reporting all of them would be redundant; the worst gap
 * (negotiation, ~28pp) tells the story.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const byBranch = groupByBranch(ctx.detectionLeads);
  const insights: Insight[] = [];

  for (const [branchId, leads] of byBranch) {
    if (leads.length < THRESHOLDS.funnelCollapse.minSample) continue;
    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;

    let worstStage: Stage | null = null;
    let worstGap = 0;
    let worstBranchPct = 0;
    let worstGroupPct = 0;

    for (const stage of FUNNEL_STAGES) {
      const branchPct = reachRatePct(leads, stage);
      const groupPct = reachRatePct(ctx.groupLeads, stage);
      const gap = groupPct - branchPct;
      if (gap > worstGap) {
        worstGap = gap;
        worstStage = stage;
        worstBranchPct = branchPct;
        worstGroupPct = groupPct;
      }
    }

    if (!worstStage || worstGap < THRESHOLDS.funnelCollapse.minGapPoints) continue;

    const droppedOff = leads.filter((l) => !l.reachedStages.has(worstStage as Stage));

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "warning",
      title: `${branch.name}'s funnel collapses at ${worstStage.replace("_", " ")}`,
      body:
        `${branch.name} reaches ${worstStage.replace("_", " ")} at ${formatPercent(worstBranchPct)}, ` +
        `${formatPercent(worstGap)} below the group's ${formatPercent(worstGroupPct)} — the largest ` +
        `single-stage gap for this branch.`,
      impactRupees: sumDealValue(droppedOff),
      metric: { value: worstBranchPct, comparison: worstGroupPct, unit: "pct" },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref(`/branches/${branchId}`, ctx.filters),
      evidence: droppedOff.map((l) => l.id),
    });
  }
  return insights;
}
