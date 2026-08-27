import type { AnalyticsContext } from "./context";
import type { Source } from "@/lib/data/types";
import { rate, median } from "./benchmark";

/**
 * Lead-source (acquisition channel) analytics.
 *
 * The interesting part of this dimension is *why* a source converts badly, and the gate frame
 * answers it. Raw conversion conflates two different failures — leads the branch never worked,
 * and leads it worked that were never going to buy. Carrying contact rate and test-drive rate
 * alongside conversion separates them: social media converts at 13.9% overall but 20.4% among
 * leads that were actually contacted, and only 59.2% of its contacted leads ever reach a test
 * drive against 90.0% for walk-ins. So roughly a third of its gap is neglect and the rest is
 * genuine lead quality — two findings with two different owners.
 */
export interface SourcePerformance {
  source: Source;
  label: string;
  totalLeads: number;
  volumeSharePct: number | null;
  contactedCount: number;
  contactRatePct: number | null;
  testDrivenCount: number;
  /** Test drives as a share of contacted leads — the gate, not a share of all leads. */
  testDriveRatePct: number | null;
  deliveredCount: number;
  /** Delivered / all leads. */
  conversionPct: number | null;
  /** Delivered / contacted — strips out the leads nobody ever worked. */
  conversionAmongContactedPct: number | null;
  revenueRupees: number;
  revenueSharePct: number | null;
  /** Revenue divided by every lead the source supplied — the true efficiency figure. */
  revenuePerLeadRupees: number | null;
  medianDealValueRupees: number | null;
  medianCycleDays: number | null;
}

const SOURCE_LABEL: Record<Source, string> = {
  walk_in: "Walk-in",
  website: "Website",
  phone_enquiry: "Phone enquiry",
  referral: "Referral",
  social_media: "Social media",
  auto_expo: "Auto expo",
};

export function sourceLabel(source: Source): string {
  return SOURCE_LABEL[source] ?? source;
}

/**
 * Scoped to the reader's current selection — branch and time both apply.
 *
 * Channel performance is a population view: "which channels worked for this branch, in this
 * period" is a legitimate and useful question, and answering it is why the global filter bar is
 * shown on this page at all. Shares (volume, revenue) are computed within the same scope, so they
 * always sum to 100% of what the reader is actually looking at.
 */
export function computeSourcePerformance(ctx: AnalyticsContext): SourcePerformance[] {
  const leads = ctx.leads;
  const total = leads.length;
  const totalRevenue = leads
    .filter((l) => l.reachedStages.has("delivered"))
    .reduce((s, l) => s + l.dealValue, 0);

  return ctx.dataset.sources
    .map((source) => {
      const ls = leads.filter((l) => l.source === source);
      const contacted = ls.filter((l) => l.wasContacted);
      const testDriven = ls.filter((l) => l.tookTestDrive);
      const delivered = ls.filter((l) => l.reachedStages.has("delivered"));
      const revenue = delivered.reduce((s, l) => s + l.dealValue, 0);

      return {
        source,
        label: sourceLabel(source),
        totalLeads: ls.length,
        volumeSharePct: rate(ls.length, total),
        contactedCount: contacted.length,
        contactRatePct: rate(contacted.length, ls.length),
        testDrivenCount: testDriven.length,
        testDriveRatePct: rate(testDriven.length, contacted.length),
        deliveredCount: delivered.length,
        conversionPct: rate(delivered.length, ls.length),
        conversionAmongContactedPct: rate(delivered.length, contacted.length),
        revenueRupees: revenue,
        revenueSharePct: rate(revenue, totalRevenue),
        revenuePerLeadRupees: ls.length === 0 ? null : revenue / ls.length,
        medianDealValueRupees: median(ls.map((l) => l.dealValue)),
        medianCycleDays: median(
          delivered.map((l) => l.cycleDays).filter((d): d is number => d !== null),
        ),
      };
    })
    .sort((a, b) => b.revenueRupees - a.revenueRupees);
}

/**
 * Narrow shape for the channel-quality detection rule, which needs only volume share and raw
 * conversion.
 *
 * Deliberately computed over `detectionLeads` (branch-scoped, never time-scoped) rather than by
 * projecting `computeSourcePerformance`, which follows the reader's time window. Alerts must
 * evaluate the current state of the business regardless of the selected period (FR-009); a rule
 * that quietly stopped firing because someone picked "last 30 days" would be a silent correctness
 * bug, which is exactly what ADR-0005's scope separation exists to prevent.
 */
export interface ChannelPerformance {
  channel: Source;
  totalLeads: number;
  deliveredCount: number;
  conversionPct: number;
  volumeSharePct: number;
}

export function computeChannelPerformance(ctx: AnalyticsContext): ChannelPerformance[] {
  const leads = ctx.detectionLeads;
  const total = leads.length;

  return ctx.dataset.sources
    .map((source) => {
      const ls = leads.filter((l) => l.source === source);
      const delivered = ls.filter((l) => l.reachedStages.has("delivered"));
      return {
        channel: source,
        totalLeads: ls.length,
        deliveredCount: delivered.length,
        conversionPct: rate(delivered.length, ls.length) ?? 0,
        volumeSharePct: rate(ls.length, total) ?? 0,
      };
    })
    .sort((a, b) => b.conversionPct - a.conversionPct);
}
