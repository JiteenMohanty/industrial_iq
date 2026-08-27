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
import { run as testDriveGate } from "./rules/test-drive-gate";
import { run as promiseReliability } from "./rules/promise-reliability";

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
  testDriveGate,
  promiseReliability,
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

/**
 * Picks the alerts the landing feed shows (FR-007a).
 *
 * Ranking and selection are deliberately separate concerns. `runInsights` returns a strict total
 * order — severity, then impact, then id — which is the correct contract for the CSV endpoint,
 * branch pages, and the determinism guarantee in FR-010. But feeding the top five of that order
 * straight into the UI produced a feed where four of the five cards were the same rule fired at
 * four different branches: technically the five most severe items, and nearly useless as a summary
 * of what is wrong with the business.
 *
 * So selection is round-robin over rules: the worst item from each distinct rule first, then the
 * second-worst of each, and so on. Within every pass the underlying ranking still decides order,
 * so nothing less severe is ever shown above something more severe *from the same rule* — the feed
 * simply spends its five slots on five different problems rather than five instances of one.
 */
export function selectHeadlines(ranked: readonly Insight[], limit = 5): Insight[] {
  const byRule = new Map<string, Insight[]>();
  for (const insight of ranked) {
    const list = byRule.get(insight.rule) ?? [];
    list.push(insight);
    byRule.set(insight.rule, list);
  }

  // Rule order follows each rule's own best item, so the most severe problem class leads.
  const queues = [...byRule.values()].sort((a, b) => ranked.indexOf(a[0]!) - ranked.indexOf(b[0]!));

  const picked: Insight[] = [];
  let round = 0;
  while (picked.length < limit) {
    const before = picked.length;
    for (const queue of queues) {
      if (picked.length >= limit) break;
      const item = queue[round];
      if (item) picked.push(item);
    }
    if (picked.length === before) break; // every queue exhausted
    round += 1;
  }
  return picked;
}
