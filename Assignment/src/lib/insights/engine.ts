import type { AnalyticsContext } from "@/lib/analytics/context";
import type { Severity } from "@/lib/data/types";
import type { Insight } from "./types";
import { run as neverContacted } from "./rules/never-contacted";
import { run as contactRate } from "./rules/contact-rate";
import { run as stuckOrders } from "./rules/stuck-orders";
import { run as coldLeads } from "./rules/cold-leads";
import { run as funnelCollapse } from "./rules/funnel-collapse";
import { run as repOutlier } from "./rules/rep-outlier";
import { run as lostReason } from "./rules/lost-reason";
import { run as channelQuality } from "./rules/channel-quality";
import { run as delayReason } from "./rules/delay-reason";

const RULES: ReadonlyArray<(ctx: AnalyticsContext) => Insight[]> = [
  neverContacted,
  contactRate,
  stuckOrders,
  coldLeads,
  funnelCollapse,
  repOutlier,
  lostReason,
  channelQuality,
  delayReason,
];

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Runs every rule and returns the full ranked list — total order: severity, then impactRupees
 * descending (null sorts last), then id ascending as the final tiebreak. The id tiebreak is what
 * makes the order total rather than merely "usually stable": without it, two insights of equal
 * severity and equal impact could swap between runs depending on rule declaration order (FR-010).
 * Truncation to the top 5 for the Action Center (FR-007a) is a presentation concern, handled by
 * the component that renders this list — the CSV endpoint and branch pages need the full ranking.
 */
export function runInsights(ctx: AnalyticsContext): Insight[] {
  const all = RULES.flatMap((rule) => rule(ctx));

  return [...all].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;

    const aImpact = a.impactRupees;
    const bImpact = b.impactRupees;
    if (aImpact === null && bImpact !== null) return 1;
    if (aImpact !== null && bImpact === null) return -1;
    if (aImpact !== null && bImpact !== null && aImpact !== bImpact) {
      return bImpact - aImpact;
    }

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
