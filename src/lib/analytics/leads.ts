import type { AnalyticsContext } from "./context";
import type { LeadStatus, Source, Stage } from "@/lib/data/types";

export interface LeadDetailStatusEntry {
  status: LeadStatus;
  timestamp: string;
  note: string;
}

/**
 * View-shaped for the client-rendered `LeadDetailSheet` (Constitution I: no `EnrichedLead` — with
 * its `Set`/`Map`-typed derived fields and back-references — crosses the server/client boundary).
 * `statusHistory` is carried through as-is: it is already sorted ascending by `dataset.ts`, and the
 * timeline is the entire point of this type (FR-025).
 */
export interface LeadDetail {
  leadId: string;
  customerName: string;
  phone: string;
  source: Source;
  modelInterested: string;
  status: LeadStatus;
  currentStage: Stage;
  branchId: string;
  branchLabel: string;
  repId: string;
  repName: string;
  dealValueRupees: number;
  ageDays: number;
  isOpen: boolean;
  statusHistory: LeadDetailStatusEntry[];
}

/** Returns null for an unknown id so a caller can render "not found" rather than throwing. */
export function computeLeadDetail(ctx: AnalyticsContext, leadId: string): LeadDetail | null {
  const lead = ctx.dataset.leadById.get(leadId);
  if (!lead) return null;

  return {
    leadId: lead.id,
    customerName: lead.customerName,
    phone: lead.phone,
    source: lead.source,
    modelInterested: lead.modelInterested,
    status: lead.status,
    currentStage: lead.currentStage,
    branchId: lead.branchId,
    branchLabel: lead.branch.label,
    repId: lead.assignedTo,
    repName: lead.rep.name,
    dealValueRupees: lead.dealValue,
    ageDays: lead.ageDays,
    isOpen: lead.isOpen,
    statusHistory: lead.statusHistory.map((e) => ({
      status: e.status,
      timestamp: e.timestamp,
      note: e.note,
    })),
  };
}
