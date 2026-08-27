import type { AnalyticsContext } from "./context";
import type { LeadStatus, RepRole, Source, Stage } from "@/lib/data/types";
import { sumDealValue } from "../insights/helpers";
import { rate, BENCHMARK } from "./benchmark";

export interface RepPerformance {
  repId: string;
  repName: string;
  role: RepRole;
  branchId: string;
  branchLabel: string;
  leadCount: number;
  deliveredCount: number;
  /** null when the rep has zero assigned leads (e.g. every branch_manager) — never NaN/0-as-fact. */
  conversionPct: number | null;
  openLeadCount: number;
  openPipelineValueRupees: number;

  // --- v2: the two gate metrics.
  // Conversion alone tells a manager a rep is behind but not what to do about it. Contact rate and
  // test-drive rate are the two things a rep actually controls day to day, and on this dataset
  // they explain almost all of the conversion spread — the range across reps runs 33.3%-94.1% on
  // contact and 30.0%-92.9% on test drives. They are the coachable numbers; conversion is the
  // scoreboard.
  contactedCount: number;
  contactRatePct: number | null;
  testDrivenCount: number;
  /** Test drives as a share of the rep's *contacted* leads, not of all assigned leads. */
  testDriveRatePct: number | null;
  revenueRupees: number;
  /** Revenue across every lead assigned — the efficiency figure a volume count hides. */
  revenuePerLeadRupees: number | null;
}

/**
 * Scoped to the reader's current selection — branch and time both apply.
 *
 * "Show me this branch's reps in November" is exactly what a sales manager wants from a rep
 * leaderboard, and refusing to answer it was the reason the global filter bar looked inert on this
 * page. Sample-size guards elsewhere (`statusVsGroup` withholds a judgement under 15 leads) keep a
 * narrow window from turning thin data into confident-looking verdicts.
 *
 * Sorted by delivered count descending (the CEO's "who actually closes deals" question), then lead
 * volume descending, then name ascending as a deterministic final tiebreak — see decision-log.md.
 */
export function computeRepPerformance(ctx: AnalyticsContext): RepPerformance[] {
  const rows = ctx.dataset.reps.map((rep) => {
    const leads = ctx.leads.filter((l) => l.assignedTo === rep.id);
    const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
    const open = leads.filter((l) => l.isOpen);
    const contacted = leads.filter((l) => l.wasContacted);
    const testDriven = leads.filter((l) => l.tookTestDrive);
    const revenue = sumDealValue(delivered);

    return {
      repId: rep.id,
      repName: rep.name,
      role: rep.role,
      branchId: rep.branchId,
      branchLabel: rep.branch.label,
      leadCount: leads.length,
      deliveredCount: delivered.length,
      conversionPct: leads.length > 0 ? (delivered.length / leads.length) * 100 : null,
      openLeadCount: open.length,
      openPipelineValueRupees: sumDealValue(open),
      contactedCount: contacted.length,
      contactRatePct: rate(contacted.length, leads.length),
      testDrivenCount: testDriven.length,
      testDriveRatePct: rate(testDriven.length, contacted.length),
      revenueRupees: revenue,
      revenuePerLeadRupees: leads.length === 0 ? null : revenue / leads.length,
    };
  });

  return rows.sort((a, b) => {
    if (a.deliveredCount !== b.deliveredCount) return b.deliveredCount - a.deliveredCount;
    if (a.leadCount !== b.leadCount) return b.leadCount - a.leadCount;
    return a.repName < b.repName ? -1 : a.repName > b.repName ? 1 : 0;
  });
}

export interface RepAssignedLead {
  leadId: string;
  customerName: string;
  modelInterested: string;
  currentStage: Stage;
  status: LeadStatus;
  ageDays: number;
  dealValueRupees: number;
  isOpen: boolean;
  source: Source;
  tookTestDrive: boolean;
  daysSinceActivity: number;
}

export interface RepDetail {
  repId: string;
  repName: string;
  role: RepRole;
  joined: string;
  branchId: string;
  branchLabel: string;
  leadCount: number;
  deliveredCount: number;
  conversionPct: number | null;
  openPipelineValueRupees: number;
  contactRatePct: number | null;
  testDriveRatePct: number | null;
  revenueRupees: number;
  revenuePerLeadRupees: number | null;
  /**
   * Every lead ever assigned to this rep (open, delivered, and lost), oldest first — FR-024 asks
   * for "assigned leads with the age of each" without restricting to open ones, and a rep's full
   * portfolio (not just what's still open) is what a manager reviewing them needs to see. `isOpen`
   * is carried on each row so the UI can still distinguish still-actionable leads at a glance.
   */
  assignedLeads: RepAssignedLead[];
}

/**
 * Returns null for an unknown id so the route can render a not-found state rather than throwing.
 *
 * Reads `windowLeads`, not `leads`: this page is already scoped to one rep by its own URL path, so
 * applying the branch filter on top could only ever empty it — a reader who lands here from a
 * branch page and then clears the branch filter should still see the same rep. The time filter
 * still applies.
 */
export function computeRepDetail(ctx: AnalyticsContext, repId: string): RepDetail | null {
  const rep = ctx.dataset.repById.get(repId);
  if (!rep) return null;

  const leads = ctx.windowLeads.filter((l) => l.assignedTo === repId);
  const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
  const open = leads.filter((l) => l.isOpen);
  const contacted = leads.filter((l) => l.wasContacted);
  const testDriven = leads.filter((l) => l.tookTestDrive);
  const revenue = sumDealValue(delivered);

  const assignedLeads: RepAssignedLead[] = [...leads]
    .sort((a, b) => b.ageDays - a.ageDays)
    .map((l) => ({
      leadId: l.id,
      customerName: l.customerName,
      modelInterested: l.modelInterested,
      currentStage: l.currentStage,
      status: l.status,
      ageDays: l.ageDays,
      dealValueRupees: l.dealValue,
      isOpen: l.isOpen,
      source: l.source,
      tookTestDrive: l.tookTestDrive,
      daysSinceActivity: l.daysSinceActivity,
    }));

  return {
    repId: rep.id,
    repName: rep.name,
    role: rep.role,
    joined: rep.joined,
    branchId: rep.branchId,
    branchLabel: rep.branch.label,
    leadCount: leads.length,
    deliveredCount: delivered.length,
    conversionPct: leads.length > 0 ? (delivered.length / leads.length) * 100 : null,
    openPipelineValueRupees: sumDealValue(open),
    contactRatePct: rate(contacted.length, leads.length),
    testDriveRatePct: rate(testDriven.length, contacted.length),
    revenueRupees: revenue,
    revenuePerLeadRupees: leads.length === 0 ? null : revenue / leads.length,
    assignedLeads,
  };
}

// ------------------------------------------------------------------------------------------
// Top vs bottom performer
// ------------------------------------------------------------------------------------------

export interface HeadToHeadMetric {
  key: string;
  label: string;
  hint?: string;
  topValue: number | null;
  bottomValue: number | null;
  unit: "count" | "pct" | "rupees";
  /** Gap in the metric's own unit — percentage points for rates, a multiple for money. */
  gapText: string;
  /** 0-1 bar fill, for rate metrics only. Null suppresses the bar. */
  topBar: number | null;
  bottomBar: number | null;
}

export interface RepHeadToHead {
  top: RepPerformance;
  bottom: RepPerformance;
  topRank: number;
  bottomRank: number;
  poolSize: number;
  minSample: number;
  metrics: HeadToHeadMetric[];
  /** The gate where the largest gap in percentage points opens. */
  widestGate: { key: "contact" | "test_drive" | "close"; label: string; gapPoints: number } | null;
}

const closeRatePct = (r: RepPerformance): number | null =>
  r.testDrivenCount === 0 ? null : (r.deliveredCount / r.testDrivenCount) * 100;

/**
 * Head-to-head between the best and worst sales officer.
 *
 * Replaces three disconnected callouts that each named a different rep for a different reason —
 * informative individually, but they never answered the question a sales manager actually asks:
 * *what separates my best rep from my worst?* One comparison across the same metric set answers it,
 * and because both reps are ranked on the same basis the reader can check the judgement rather than
 * taking it on trust.
 *
 * Ranked on revenue per lead, not total revenue: total revenue rewards whoever was handed the
 * biggest book. A minimum sample (the shared benchmark floor) keeps a rep with a handful of lucky
 * leads out of either end — on this dataset that floor is what stops a 14-lead rep taking first
 * place from a 25-lead rep doing the same job at scale.
 *
 * Returns null when fewer than two reps clear the floor, rather than inventing a comparison.
 */
export function computeRepHeadToHead(ctx: AnalyticsContext): RepHeadToHead | null {
  const eligible = computeRepPerformance(ctx).filter(
    (r) => r.role === "sales_officer" && r.leadCount >= BENCHMARK.minSample,
  );
  if (eligible.length < 2) return null;

  const ranked = [...eligible].sort((a, b) => {
    const av = a.revenuePerLeadRupees ?? -1;
    const bv = b.revenuePerLeadRupees ?? -1;
    if (av !== bv) return bv - av;
    return a.repId.localeCompare(b.repId); // total order, so the pair never swaps between renders
  });

  const top = ranked[0] as RepPerformance;
  const bottom = ranked[ranked.length - 1] as RepPerformance;

  const ratio = (a: number | null, b: number | null): string => {
    if (a === null || b === null || b <= 0) return "—";
    const x = a / b;
    return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`;
  };
  const points = (a: number | null, b: number | null): string => {
    if (a === null || b === null) return "—";
    const gap = a - b;
    return `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}pp`;
  };

  const metrics: HeadToHeadMetric[] = [
    {
      key: "leads",
      label: "Leads assigned",
      hint: "the size of the book",
      topValue: top.leadCount,
      bottomValue: bottom.leadCount,
      unit: "count",
      gapText: ratio(top.leadCount, bottom.leadCount),
      topBar: null,
      bottomBar: null,
    },
    {
      key: "contact",
      label: "Contact rate",
      hint: "of leads assigned",
      topValue: top.contactRatePct,
      bottomValue: bottom.contactRatePct,
      unit: "pct",
      gapText: points(top.contactRatePct, bottom.contactRatePct),
      topBar: (top.contactRatePct ?? 0) / 100,
      bottomBar: (bottom.contactRatePct ?? 0) / 100,
    },
    {
      key: "test_drive",
      label: "Test-drive rate",
      hint: "of contacted leads",
      topValue: top.testDriveRatePct,
      bottomValue: bottom.testDriveRatePct,
      unit: "pct",
      gapText: points(top.testDriveRatePct, bottom.testDriveRatePct),
      topBar: (top.testDriveRatePct ?? 0) / 100,
      bottomBar: (bottom.testDriveRatePct ?? 0) / 100,
    },
    {
      key: "close",
      label: "Close rate",
      hint: "of test-driven leads",
      topValue: closeRatePct(top),
      bottomValue: closeRatePct(bottom),
      unit: "pct",
      gapText: points(closeRatePct(top), closeRatePct(bottom)),
      topBar: (closeRatePct(top) ?? 0) / 100,
      bottomBar: (closeRatePct(bottom) ?? 0) / 100,
    },
    {
      key: "delivered",
      label: "Units delivered",
      topValue: top.deliveredCount,
      bottomValue: bottom.deliveredCount,
      unit: "count",
      gapText: ratio(top.deliveredCount, bottom.deliveredCount),
      topBar: null,
      bottomBar: null,
    },
    {
      key: "revenue",
      label: "Revenue",
      topValue: top.revenueRupees,
      bottomValue: bottom.revenueRupees,
      unit: "rupees",
      gapText: ratio(top.revenueRupees, bottom.revenueRupees),
      topBar: null,
      bottomBar: null,
    },
    {
      key: "revenue_per_lead",
      label: "Revenue per lead",
      hint: "the ranking metric",
      topValue: top.revenuePerLeadRupees,
      bottomValue: bottom.revenuePerLeadRupees,
      unit: "rupees",
      gapText: ratio(top.revenuePerLeadRupees, bottom.revenuePerLeadRupees),
      topBar: null,
      bottomBar: null,
    },
  ];

  const gateGaps = ([
    { key: "contact", label: "contact", a: top.contactRatePct, b: bottom.contactRatePct },
    { key: "test_drive", label: "test-drive", a: top.testDriveRatePct, b: bottom.testDriveRatePct },
    { key: "close", label: "close", a: closeRatePct(top), b: closeRatePct(bottom) },
  ] as const)
    .filter((g) => g.a !== null && g.b !== null)
    .map((g) => ({ key: g.key, label: g.label, gapPoints: (g.a as number) - (g.b as number) }))
    .sort((x, y) => y.gapPoints - x.gapPoints);

  return {
    top,
    bottom,
    topRank: 1,
    bottomRank: ranked.length,
    poolSize: ranked.length,
    minSample: BENCHMARK.minSample,
    metrics,
    widestGate: gateGaps[0] ?? null,
  };
}
