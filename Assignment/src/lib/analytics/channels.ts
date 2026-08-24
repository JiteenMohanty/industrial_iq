import type { AnalyticsContext } from "./context";
import type { Source } from "@/lib/data/types";

export interface ChannelPerformance {
  channel: Source;
  totalLeads: number;
  deliveredCount: number;
  conversionPct: number;
  volumeSharePct: number;
}

export function computeChannelPerformance(ctx: AnalyticsContext): ChannelPerformance[] {
  const leads = ctx.groupLeads;
  const total = leads.length;

  const byChannel = new Map<Source, typeof leads>();
  for (const lead of leads) {
    const list = byChannel.get(lead.source) ?? [];
    list.push(lead);
    byChannel.set(lead.source, list);
  }

  return Array.from(byChannel.entries())
    .map(([channel, channelLeads]) => {
      const delivered = channelLeads.filter((l) => l.reachedStages.has("delivered")).length;
      return {
        channel,
        totalLeads: channelLeads.length,
        deliveredCount: delivered,
        conversionPct: channelLeads.length > 0 ? (delivered / channelLeads.length) * 100 : 0,
        volumeSharePct: total > 0 ? (channelLeads.length / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.conversionPct - a.conversionPct);
}
