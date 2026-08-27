import type { AnalyticsContext } from "@/lib/analytics/context";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent, formatDays } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { groupByBranch, evidenceHref } from "../helpers";

export const slug = "promise-reliability" as const;

/**
 * Branches that routinely miss the delivery date they quoted the customer (FR-011 rule 11).
 *
 * Every lead carries an `expected_close_date` — a promise the dealership made. Comparing it to the
 * actual delivery date measures something units and revenue cannot see, and on this dataset the two
 * do not move together: the group's highest-revenue branch is also its least reliable, missing its
 * quoted date on nearly two thirds of deliveries by a median of a week.
 *
 * Rated `warning`, not `critical`: the revenue is already banked and the customer already has the
 * car. What is at risk is repeat business and referral, which this dataset cannot price — so the
 * rule deliberately carries `impactRupees: null` rather than attaching an invented number to it.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const byBranch = groupByBranch(ctx.detectionLeads);

  const groupSlips = ctx.groupLeads
    .map((l) => l.closeSlipDays)
    .filter((v): v is number => v !== null);
  const groupLatePct =
    groupSlips.length === 0
      ? 0
      : (groupSlips.filter((s) => s > 0).length / groupSlips.length) * 100;

  const insights: Insight[] = [];
  for (const [branchId, leads] of byBranch) {
    const delivered = leads.filter((l) => l.closeSlipDays !== null);
    if (delivered.length < THRESHOLDS.promiseReliability.minSample) continue;

    const late = delivered.filter((l) => (l.closeSlipDays as number) > 0);
    const latePct = (late.length / delivered.length) * 100;
    if (latePct < THRESHOLDS.promiseReliability.latePctFloor) continue;

    const first = leads[0];
    if (!first) continue;
    const branch = first.branch;

    const lateSlips = late.map((l) => l.closeSlipDays as number).sort((a, b) => a - b);
    const medianLateSlip = lateSlips[Math.floor(lateSlips.length / 2)] ?? 0;

    insights.push({
      id: `${slug}:${branchId}`,
      rule: slug,
      severity: "warning",
      title: `${branch.name} misses its promised delivery date on ${formatPercent(latePct)} of sales`,
      body:
        `${late.length} of ${delivered.length} delivered customers at ${branch.name} got their car ` +
        `after the date they were quoted, typically ${formatDays(medianLateSlip)} late. ` +
        `Fires above the ${THRESHOLDS.promiseReliability.latePctFloor}% floor; the group misses ` +
        `${formatPercent(groupLatePct)} of its dates. Revenue is unaffected — repeat business is what is at risk.`,
      impactRupees: null,
      metric: { value: latePct, comparison: groupLatePct, unit: "pct" },
      entity: { kind: "branch", id: branchId, label: branch.label },
      href: buildHref("/deliveries", ctx.filters, { branchId }),
      evidenceHref: evidenceHref(ctx.filters, "delivered", { branch: branchId }),
      action: "Quote dates from this branch's actual fulfilment time, not the group average.",
      evidence: late.map((l) => l.id),
    });
  }
  return insights;
}
