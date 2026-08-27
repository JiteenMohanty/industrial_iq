import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import { formatDays } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch, evidenceHref } from "../helpers";

export const slug = "stuck-orders" as const;

/**
 * Orders placed >=27 days ago with no delivery, fired per branch at >=1 such order (FR-011 rule
 * 3). Distinct from the 38-order/₹8.59 Cr headline in analytics/pipeline.ts, which counts every
 * stuck order regardless of age — this rule only counts the subset old enough to alert on
 * (research.md R4). Conflating the two is the specific bug that distinction guards against.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const alerting = ctx.detectionLeads.filter(
    (l) => l.isStuckOrder && l.daysSinceOrder !== null && l.daysSinceOrder >= THRESHOLDS.stuckOrders.minDays,
  );
  const byBranch = groupByBranch(alerting);

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;
    const oldest = Math.max(...leads.map((l) => l.daysSinceOrder ?? 0));

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "critical",
      title: `${branch.name} has ${leads.length} stuck orders past ${THRESHOLDS.stuckOrders.minDays} days`,
      body:
        `${leads.length} orders at ${branch.name} were placed at least ${THRESHOLDS.stuckOrders.minDays} days ago ` +
        `and still have no delivery recorded. The oldest has waited ${formatDays(oldest)}.`,
      impactRupees: sumDealValue(leads),
      metric: { value: leads.length, comparison: THRESHOLDS.stuckOrders.minDays, unit: "count" },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref("/deliveries", ctx.filters, { branchId }),
      evidenceHref: evidenceHref(ctx.filters, "stuck_orders", { branch: branchId }),
      action: "Call each customer with a delivery date, or release the allocation.",
      evidence: leads.map((l) => l.id),
    });
  }
  return insights;
}
