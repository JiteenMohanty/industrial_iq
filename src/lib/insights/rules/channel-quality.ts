import type { AnalyticsContext } from "@/lib/analytics/context";
import type { Source } from "@/lib/data/types";
import { buildHref } from "@/lib/filters/parse";
import { formatPercent } from "@/lib/format";
import type { Insight } from "../types";
import { THRESHOLDS } from "../thresholds";
import { sumDealValue, evidenceHref } from "../helpers";

export const slug = "channel-quality" as const;

/**
 * A channel converting below 20% while supplying >=10% of lead volume (FR-011 rule 8). Uses
 * `detectionLeads` (branch-filtered) so channel quality can be inspected per branch too, but
 * volume share is always measured against the same detection scope's total, not the full group,
 * so a branch filter narrows the comparison meaningfully rather than diluting it against leads
 * the reader isn't looking at.
 */
export function run(ctx: AnalyticsContext): Insight[] {
  const total = ctx.detectionLeads.length;
  if (total === 0) return [];

  const byChannel = new Map<Source, typeof ctx.detectionLeads>();
  for (const lead of ctx.detectionLeads) {
    const list = byChannel.get(lead.source) ?? [];
    list.push(lead);
    byChannel.set(lead.source, list);
  }

  const insights: Insight[] = [];
  for (const [channel, leads] of byChannel) {
    const volumeSharePct = (leads.length / total) * 100;
    if (volumeSharePct < THRESHOLDS.channelQuality.minVolumeSharePct) continue;

    const delivered = leads.filter((l) => l.reachedStages.has("delivered")).length;
    const conversionPct = (delivered / leads.length) * 100;
    if (conversionPct >= THRESHOLDS.channelQuality.conversionCeilingPct) continue;

    const lost = leads.filter((l) => l.isLost);

    insights.push({
      id: `${slug}:${channel}`,
      rule: slug,
      severity: "info",
      title: `${channel.replace("_", " ")} converts poorly despite meaningful volume`,
      body:
        `${channel.replace("_", " ")} converts ${formatPercent(conversionPct)} of its leads while ` +
        `supplying ${formatPercent(volumeSharePct)} of volume — below the ` +
        `${THRESHOLDS.channelQuality.conversionCeilingPct}% conversion floor.`,
      impactRupees: sumDealValue(lost),
      metric: { value: conversionPct, comparison: volumeSharePct, unit: "pct" },
      entity: { kind: "channel", id: channel, label: channel.replace("_", " ") },
      href: buildHref("/sources", ctx.filters),
      evidenceHref: evidenceHref(ctx.filters, "all", { source: channel }),
      action: "Compare cost per lead against its revenue per lead before renewing this spend.",
      evidence: lost.map((l) => l.id),
    });
  }
  return insights;
}
