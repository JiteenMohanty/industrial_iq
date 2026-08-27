import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { groupByBranch, evidenceHref } from "../helpers";

export const slug = "delay-reason" as const;

/**
 * A single delay reason accounting for >=40% of a branch's delayed deliveries, minimum 5 delayed
 * deliveries to qualify (FR-011 rule 9). Delivery records are reached via each lead's `.delivery`
 * back-reference rather than a separate detection-scoped deliveries list — AnalyticsContext only
 * exposes `detectionLeads` for branch-filtered/time-unfiltered scope, and every delivery has
 * exactly one owning lead, so filtering leads first is equivalent and avoids adding a fourth
 * context array for one rule. Returns [] on the verified dataset: max concentration is 33.3%
 * (Lakeside, which also fails the 5-delivery minimum) — below the 40% floor everywhere
 * (research.md R7).
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const delayedLeads = ctx.detectionLeads.filter((l) => l.delivery?.isDelayed);
  const byBranch = groupByBranch(delayedLeads);

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    if (leads.length < THRESHOLDS.delayReason.minSample) continue;
    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;

    const byReason = new Map<string, typeof leads>();
    for (const lead of leads) {
      const reason = lead.delivery?.delayReason ?? "Unknown";
      const list = byReason.get(reason) ?? [];
      list.push(lead);
      byReason.set(reason, list);
    }

    let topReason: string | null = null;
    let topLeads: typeof leads = [];
    for (const [reason, group] of byReason) {
      if (group.length > topLeads.length) {
        topReason = reason;
        topLeads = group;
      }
    }
    if (!topReason) continue;

    const concentrationPct = (topLeads.length / leads.length) * 100;
    if (concentrationPct < THRESHOLDS.delayReason.concentrationPct) continue;

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "info",
      title: `${branch.name}'s delivery delays concentrate on "${topReason}"`,
      body:
        `"${topReason}" accounts for ${topLeads.length} of ${leads.length} delayed deliveries at ` +
        `${branch.name} (${formatPercent(concentrationPct)}), above the ` +
        `${THRESHOLDS.delayReason.concentrationPct}% concentration floor.`,
      impactRupees: null,
      metric: {
        value: concentrationPct,
        comparison: THRESHOLDS.delayReason.concentrationPct,
        unit: "pct",
      },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref("/deliveries", ctx.filters, { branchId }),
      evidenceHref: evidenceHref(ctx.filters, "delivered", { branch: branchId }),
      action: "Take this one reason to the branch's operations lead — it dominates their delays.",
      evidence: topLeads.map((l) => l.id),
    });
  }
  return insights;
}
