import type { AnalyticsContext } from "@/lib/analytics/context";
import type { EnrichedLead } from "@/lib/data/types";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, evidenceHref } from "../helpers";

export const slug = "rep-outlier" as const;

function conversionRatePct(leads: readonly EnrichedLead[]): number {
  if (leads.length === 0) return 0;
  const delivered = leads.filter((l) => l.reachedStages.has("delivered")).length;
  return (delivered / leads.length) * 100;
}

/**
 * A rep's lead-to-delivery conversion falling >=15pp below their branch's own rate, minimum 15
 * leads to qualify (FR-011 rule 6). Returns [] on the verified dataset: Lakeside's reps convert
 * uniformly poorly (4.5%-11.1%, a 6.6pp spread) rather than one rep dragging down otherwise-healthy
 * peers, and no other branch has a qualifying gap either. A rule finding nothing is a valid
 * outcome, not a bug (research.md R7).
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const leadsByRep = ctx.dataset.leadsByRep;
  const insights: Insight[] = [];

  for (const rep of ctx.dataset.reps) {
    const repLeads = (leadsByRep.get(rep.id) ?? []).filter(
      (l) => ctx.filters.branchId === null || l.branchId === ctx.filters.branchId,
    );
    if (repLeads.length < THRESHOLDS.repOutlier.minSample) continue;

    const branchLeads = ctx.groupLeads.filter((l) => l.branchId === rep.branchId);
    const branchRatePct = conversionRatePct(branchLeads);
    const repRatePct = conversionRatePct(repLeads);
    const gap = branchRatePct - repRatePct;
    if (gap < THRESHOLDS.repOutlier.minGapPoints) continue;

    insights.push({
      id: `${slug}:${rep.id}`,
      rule: slug,
      severity: "warning",
      title: `${rep.name} converts well below ${rep.branch.name}'s average`,
      body:
        `${rep.name} converts ${formatPercent(repRatePct)} of leads to delivery, ` +
        `${formatPercent(gap)} below ${rep.branch.name}'s ${formatPercent(branchRatePct)} average.`,
      impactRupees: sumDealValue(repLeads.filter((l) => l.isOpen)),
      metric: { value: repRatePct, comparison: branchRatePct, unit: "pct" },
      entity: { kind: "rep", id: rep.id, label: rep.name },
      href: buildHref(`/reps/${rep.id}`, ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "all", { rep: rep.id }),
      action: "Review this rep's pipeline with their branch manager.",
      evidence: repLeads.map((l) => l.id),
    });
  }
  return insights;
}
