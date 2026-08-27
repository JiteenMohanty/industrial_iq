import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent, formatCurrency } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, groupByBranch, evidenceHref } from "../helpers";

export const slug = "test-drive-gate" as const;

/**
 * Branches converting too few of their *contacted* leads into test drives (FR-011 rule 10).
 *
 * This rule exists because of the strongest single finding in the dataset: the test drive is an
 * absolute gate. Of the 391 leads that were contacted, 91 never took one — and not one of those 91
 * reached negotiation, an order, or a delivery. A lead stalled here is not a weaker opportunity,
 * it is a closed one, which is why this fires at `critical` despite sitting mid-funnel.
 *
 * Threshold is 70% of contacted leads, against a group figure of 76.7%. On the shipped extract
 * exactly one branch breaches it, which is the honest outcome — the rule is not tuned to produce a
 * fuller feed.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const byBranch = groupByBranch(ctx.detectionLeads);

  const groupContacted = ctx.groupLeads.filter((l) => l.wasContacted);
  const groupRatePct =
    groupContacted.length === 0
      ? 0
      : (groupContacted.filter((l) => l.tookTestDrive).length / groupContacted.length) * 100;

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    const contacted = leads.filter((l) => l.wasContacted);
    if (contacted.length < THRESHOLDS.testDriveGate.minSample) continue;

    const stalled = contacted.filter((l) => !l.tookTestDrive);
    const ratePct = ((contacted.length - stalled.length) / contacted.length) * 100;
    if (ratePct >= THRESHOLDS.testDriveGate.floorPct) continue;

    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;
    const strandedValue = sumDealValue(stalled);

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "critical",
      title: `${branch.name} gets only ${formatPercent(ratePct)} of contacted leads into a test drive`,
      body:
        `${stalled.length} leads at ${branch.name} were contacted but never test-driven, stranding ` +
        `${formatCurrency(strandedValue)}. Group-wide, no lead has ever been delivered without a ` +
        `test drive, so these are closed opportunities rather than slow ones. ` +
        `Below the ${THRESHOLDS.testDriveGate.floorPct}% floor; group average is ${formatPercent(groupRatePct)}.`,
      impactRupees: strandedValue,
      metric: { value: ratePct, comparison: groupRatePct, unit: "pct" },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref(`/branches/${branchId}`, ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "no_test_drive", { branch: branchId }),
      action: "Book test drives for these leads — nothing downstream can move until they happen.",
      evidence: stalled.map((l) => l.id),
    });
  }
  return insights;
}
