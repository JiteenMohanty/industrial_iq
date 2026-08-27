import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch, evidenceHref } from "../helpers";

export const slug = "lost-reason" as const;

/**
 * A single loss reason accounting for >=40% of a branch's losses, minimum 10 losses to qualify
 * (FR-011 rule 7). "Losses" here means status_history-derived (see decision-log.md) — a lead only
 * counts if its history actually contains a "lost" entry. Returns [] on the verified dataset: the
 * most concentrated branch tops out at ~22% (Eastside, "Better offer elsewhere") — reasons are
 * genuinely spread, not concentrated. A rule finding nothing is a valid outcome (research.md R7).
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const lostLeads = ctx.detectionLeads.filter((l) => l.isLost);
  const byBranch = groupByBranch(lostLeads);

  const insights: Insight[] = [];
  for (const [branchId, losses] of byBranch) {
    if (losses.length < THRESHOLDS.lostReason.minSample) continue;
    const first = losses[0];
    if (!first) continue;
    const branch = first.branch;

    const byReason = new Map<string, typeof losses>();
    for (const lead of losses) {
      const reason = lead.lostReason ?? "Unknown";
      const list = byReason.get(reason) ?? [];
      list.push(lead);
      byReason.set(reason, list);
    }

    let topReason: string | null = null;
    let topLeads: typeof losses = [];
    for (const [reason, leads] of byReason) {
      if (leads.length > topLeads.length) {
        topReason = reason;
        topLeads = leads;
      }
    }
    if (!topReason) continue;

    const concentrationPct = (topLeads.length / losses.length) * 100;
    if (concentrationPct < THRESHOLDS.lostReason.concentrationPct) continue;

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "warning",
      title: `${branch.name} loses most deals to "${topReason}"`,
      body:
        `"${topReason}" accounts for ${topLeads.length} of ${losses.length} losses at ${branch.name} ` +
        `(${formatPercent(concentrationPct)}), above the ${THRESHOLDS.lostReason.concentrationPct}% concentration floor.`,
      impactRupees: sumDealValue(topLeads),
      metric: {
        value: concentrationPct,
        comparison: THRESHOLDS.lostReason.concentrationPct,
        unit: "pct",
      },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref(`/branches/${branchId}`, ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "lost", { branch: branchId }),
      action: "Check whether this reason reflects a real local constraint or a recording habit.",
      evidence: topLeads.map((l) => l.id),
    });
  }
  return insights;
}
