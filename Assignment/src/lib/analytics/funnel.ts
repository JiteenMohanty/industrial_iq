import type { AnalyticsContext } from "./context";
import { FUNNEL_STAGES, type Stage } from "@/lib/data/types";
import { daysBetween } from "@/lib/time";

export interface FunnelStagePoint {
  stage: Stage;
  count: number;
  pctOfTop: number;
  /** Percentage points lost since the previous stage; null for the first stage ("new"). */
  dropOffFromPrevious: number | null;
}

export interface FunnelResult {
  stages: FunnelStagePoint[];
}

/**
 * Stage membership comes from `reachedStages` — ever-reached, not current `status` (Constitution
 * III, FR-017). `scope.branchId`, when given, powers the branch overlay (FR-013) against the same
 * group population the unscoped call would use; the default (no scope) always reflects the full
 * group regardless of the reader's active branch filter, so the overlay has a stable baseline to
 * compare against.
 */
export function computeFunnel(ctx: AnalyticsContext, scope?: { branchId?: string }): FunnelResult {
  const leads = scope?.branchId
    ? ctx.groupLeads.filter((l) => l.branchId === scope.branchId)
    : ctx.groupLeads;

  const top = leads.length;
  let prevCount = top;

  const stages: FunnelStagePoint[] = FUNNEL_STAGES.map((stage, i) => {
    const count = leads.filter((l) => l.reachedStages.has(stage)).length;
    const pctOfTop = top > 0 ? (count / top) * 100 : 0;
    const dropOffFromPrevious =
      i === 0 ? null : prevCount > 0 ? 100 - (count / prevCount) * 100 : null;
    prevCount = count;
    return { stage, count, pctOfTop, dropOffFromPrevious };
  });

  return { stages };
}

export interface StageDuration {
  fromStage: Stage;
  toStage: Stage;
  avgDays: number;
}

/** Average time between consecutive stage timestamps, over leads that reached both. */
export function computeStageDurations(ctx: AnalyticsContext): StageDuration[] {
  const leads = ctx.groupLeads;
  const durations: StageDuration[] = [];

  for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
    const from = FUNNEL_STAGES[i];
    const to = FUNNEL_STAGES[i + 1];
    if (!from || !to) continue;

    const gaps: number[] = [];
    for (const lead of leads) {
      const fromTs = lead.stageTimestamps[from];
      const toTs = lead.stageTimestamps[to];
      if (fromTs && toTs) gaps.push(daysBetween(fromTs, toTs));
    }

    durations.push({
      fromStage: from,
      toStage: to,
      avgDays: gaps.length > 0 ? gaps.reduce((sum, d) => sum + d, 0) / gaps.length : 0,
    });
  }
  return durations;
}

export interface LossStageBucket {
  stage: Stage;
  count: number;
}

export interface LossReasonBucket {
  reason: string;
  count: number;
}

export interface LossBreakdown {
  byStage: LossStageBucket[];
  byReason: LossReasonBucket[];
}

/**
 * Counts only leads whose status_history actually contains a "lost" entry — the raw `status`
 * field is wrong for 14 leads in this dataset (see decision-log.md). `isLost`/`lostFromStage` are
 * already status_history-derived, so this needs no special-casing here.
 */
export function computeLossBreakdown(ctx: AnalyticsContext): LossBreakdown {
  const lost = ctx.groupLeads.filter((l) => l.isLost);

  const byStageMap = new Map<Stage, number>();
  for (const lead of lost) {
    if (!lead.lostFromStage) continue;
    byStageMap.set(lead.lostFromStage, (byStageMap.get(lead.lostFromStage) ?? 0) + 1);
  }

  const byReasonMap = new Map<string, number>();
  for (const lead of lost) {
    const reason = lead.lostReason ?? "Unknown";
    byReasonMap.set(reason, (byReasonMap.get(reason) ?? 0) + 1);
  }

  return {
    byStage: Array.from(byStageMap.entries()).map(([stage, count]) => ({ stage, count })),
    byReason: Array.from(byReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
