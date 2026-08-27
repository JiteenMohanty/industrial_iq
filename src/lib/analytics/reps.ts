import type { AnalyticsContext } from "./context";
import type { LeadStatus, RepRole, Source, Stage } from "@/lib/data/types";
import { sumDealValue } from "../insights/helpers";
import { rate } from "./benchmark";

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
