import type { AnalyticsContext } from "./context";
import type { LeadStatus, RepRole, Stage } from "@/lib/data/types";
import { sumDealValue } from "../insights/helpers";

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
}

/**
 * Full-group, unfiltered by time or branch (`ctx.groupLeads`) — the same "structural comparison"
 * convention already established by `computeDeliveryByBranch`/`computeBranchSparklines`/
 * `computeFunnel`: a leaderboard comparing every rep only makes sense measured on the same,
 * unwindowed basis. `Filters` also has no rep dimension to window by even if this were desired.
 * Sorted by delivered count descending (the CEO's "who actually closes deals" question), then lead
 * volume descending, then name ascending as a deterministic final tiebreak — see decision-log.md.
 */
export function computeRepPerformance(ctx: AnalyticsContext): RepPerformance[] {
  const rows = ctx.dataset.reps.map((rep) => {
    const leads = ctx.groupLeads.filter((l) => l.assignedTo === rep.id);
    const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
    const open = leads.filter((l) => l.isOpen);

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
  /**
   * Every lead ever assigned to this rep (open, delivered, and lost), oldest first — FR-024 asks
   * for "assigned leads with the age of each" without restricting to open ones, and a rep's full
   * portfolio (not just what's still open) is what a manager reviewing them needs to see. `isOpen`
   * is carried on each row so the UI can still distinguish still-actionable leads at a glance.
   */
  assignedLeads: RepAssignedLead[];
}

/** Returns null for an unknown id so the route can render a not-found state rather than throwing. */
export function computeRepDetail(ctx: AnalyticsContext, repId: string): RepDetail | null {
  const rep = ctx.dataset.repById.get(repId);
  if (!rep) return null;

  const leads = ctx.groupLeads.filter((l) => l.assignedTo === repId);
  const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
  const open = leads.filter((l) => l.isOpen);

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
    assignedLeads,
  };
}
