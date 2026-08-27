import type { AnalyticsContext } from "@/lib/analytics/context";
import type { Severity } from "@/lib/data/types";
import { buildHref } from "@/lib/filters/parse";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch, evidenceHref } from "../helpers";

export const slug = "cold-leads" as const;

function severityFor(daysSinceActivity: number): Severity | null {
  if (daysSinceActivity >= THRESHOLDS.coldLeads.criticalDays) return "critical";
  if (daysSinceActivity >= THRESHOLDS.coldLeads.warningDays) return "warning";
  if (daysSinceActivity >= THRESHOLDS.coldLeads.infoDays) return "info";
  return null;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Open leads with no activity for >=7 days, fired per branch (FR-011 rule 4). One insight per
 * branch, at the worst severity tier present among its cold leads; evidence lists every cold lead
 * at that branch regardless of which tier each individual lead falls in.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const cold = ctx.detectionLeads
    .filter((l) => l.isOpen && l.daysSinceActivity >= THRESHOLDS.coldLeads.infoDays)
    .map((l) => ({ lead: l, severity: severityFor(l.daysSinceActivity) }))
    .filter((x): x is { lead: (typeof ctx.detectionLeads)[number]; severity: Severity } =>
      x.severity !== null,
    );

  const byBranch = groupByBranch(cold.map((x) => x.lead));
  const severityByBranch = new Map<string, Severity>();
  for (const { lead, severity } of cold) {
    const current = severityByBranch.get(lead.branchId);
    if (!current || SEVERITY_RANK[severity] < SEVERITY_RANK[current]) {
      severityByBranch.set(lead.branchId, severity);
    }
  }

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;
    const severity = severityByBranch.get(branchId) ?? "info";
    const oldest = Math.max(...leads.map((l) => l.daysSinceActivity));

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity,
      title: `${branch.name} has ${leads.length} leads gone cold`,
      body:
        `${leads.length} open leads at ${branch.name} have had no activity for ${THRESHOLDS.coldLeads.infoDays} ` +
        `or more days. The stalest has been untouched for ${oldest} days.`,
      impactRupees: sumDealValue(leads),
      metric: { value: leads.length, comparison: THRESHOLDS.coldLeads.infoDays, unit: "count" },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref(`/branches/${branchId}`, ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "cold", { branch: branchId }),
      action: "Work the list this week — these are still open and still winnable.",
      evidence: leads.map((l) => l.id),
    });
  }
  return insights;
}
