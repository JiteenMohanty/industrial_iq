import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch, evidenceHref } from "../helpers";

export const slug = "contact-rate" as const;

/** Branches contacting fewer than 70% of their leads, minimum 15 leads to qualify (FR-011 rule 2). */
export function run(ctx: AnalyticsContext): Insight[] {
  const byBranch = groupByBranch(ctx.detectionLeads);
  const groupContacted = ctx.groupLeads.filter((l) => l.reachedStages.has("contacted")).length;
  const groupRatePct = (groupContacted / ctx.groupLeads.length) * 100;

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    if (leads.length < THRESHOLDS.contactRate.minSample) continue;

    const uncontacted = leads.filter((l) => !l.reachedStages.has("contacted"));
    const contactedCount = leads.length - uncontacted.length;
    const ratePct = (contactedCount / leads.length) * 100;
    if (ratePct >= THRESHOLDS.contactRate.floorPct) continue;

    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "critical",
      title: `${branch.name} contacts only ${formatPercent(ratePct)} of its leads`,
      body:
        `${branch.name} contacted ${contactedCount} of ${leads.length} leads (${formatPercent(ratePct)}), ` +
        `below the ${THRESHOLDS.contactRate.floorPct}% floor. Group average is ${formatPercent(groupRatePct)}.`,
      impactRupees: sumDealValue(uncontacted),
      metric: { value: ratePct, comparison: groupRatePct, unit: "pct" },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref(`/branches/${branchId}`, ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "never_contacted", { branch: branchId }),
      action: "Review this branch's lead-assignment process — the gap is at intake, not at closing.",
      evidence: uncontacted.map((l) => l.id),
    });
  }
  return insights;
}
