import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch, evidenceHref } from "../helpers";

export const slug = "never-contacted" as const;

/**
 * Leads that never reached `contacted` — open or already lost as a direct result — fired per
 * branch at >=5 such leads (FR-011 rule 1). Deliberately not restricted to currently-open leads:
 * on this dataset every never-contacted lead that has resolved did so by being lost (114 of 119
 * group-wide), and only 5 remain open at all. Gating on `isOpen` would make this rule structurally
 * unable to fire on real data — see decision-log.md for the verification and the correction to
 * spec.md FR-005/FR-011 this implementation reflects.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const candidates = ctx.detectionLeads.filter((l) => !l.reachedStages.has("contacted"));
  const byBranch = groupByBranch(candidates);

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    if (leads.length < THRESHOLDS.neverContacted.minLeadsToFire) continue;
    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "critical",
      title: `${branch.name} has ${leads.length} leads that were never contacted`,
      body:
        `${leads.length} leads at ${branch.name} have never reached the contacted stage — ` +
        `nobody ever followed up, whether the lead is still open or has since been lost as a ` +
        `direct result. Fires once a branch reaches ${THRESHOLDS.neverContacted.minLeadsToFire} such leads.`,
      impactRupees: sumDealValue(leads),
      metric: {
        value: leads.length,
        comparison: THRESHOLDS.neverContacted.minLeadsToFire,
        unit: "count",
      },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref(`/branches/${branchId}`, ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "never_contacted", { branch: branchId }),
      action: "Assign these leads to a rep today and call them — every one is currently worth zero.",
      evidence: leads.map((l) => l.id),
    });
  }
  return insights;
}
