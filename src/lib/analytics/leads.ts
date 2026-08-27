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

// ---------------------------------------------------------------------------------------------
// Lead explorer (v2)
// ---------------------------------------------------------------------------------------------

/**
 * The evidence view the first version was missing.
 *
 * Previously an alert's "view evidence" link landed on a branch summary page — which showed that
 * branch's metrics but not the specific leads the alert was actually about, so the only way to
 * reach the records was to download the CSV. Every alert now links here with its cohort applied,
 * which is what makes the drill-down claim (FR-008, SC-002) literally true in-product.
 */
export type LeadCohort =
  | "all"
  | "never_contacted"
  | "no_test_drive"
  | "stuck_orders"
  | "cold"
  | "open"
  | "lost"
  | "delivered";

export const LEAD_COHORTS: { key: LeadCohort; label: string; description: string }[] = [
  { key: "all", label: "All leads", description: "Every lead in scope." },
  {
    key: "never_contacted",
    label: "Never contacted",
    description: "Never reached the contacted stage — nobody followed up.",
  },
  {
    key: "no_test_drive",
    label: "No test drive",
    description: "Contacted but never got into a car. No such lead has ever been delivered.",
  },
  {
    key: "stuck_orders",
    label: "Stuck orders",
    description: "Order placed, no delivery recorded.",
  },
  { key: "cold", label: "Cold (7+ days)", description: "Open with no activity for 7 days or more." },
  { key: "open", label: "Open", description: "Still in the funnel — neither delivered nor lost." },
  { key: "lost", label: "Lost", description: "Exited the funnel without buying." },
  { key: "delivered", label: "Delivered", description: "Completed and handed over." },
];

export interface LeadQuery {
  cohort: LeadCohort;
  branchId?: string | undefined;
  repId?: string | undefined;
  model?: string | undefined;
  source?: Source | undefined;
  stage?: Stage | undefined;
  /** Explicit id allowlist — how an insight hands its exact evidence set to this view. */
  ids?: readonly string[] | undefined;
  sort?: LeadSortKey | undefined;
  dir?: "asc" | "desc" | undefined;
}

export type LeadSortKey = "value" | "age" | "idle" | "customer" | "stage";

export interface LeadRow {
  leadId: string;
  customerName: string;
  phone: string;
  branchId: string;
  branchName: string;
  repId: string;
  repName: string;
  model: string;
  source: Source;
  status: LeadStatus;
  currentStage: Stage;
  dealValueRupees: number;
  ageDays: number;
  daysSinceActivity: number;
  daysSinceOrder: number | null;
  wasContacted: boolean;
  tookTestDrive: boolean;
  isOpen: boolean;
  isStuckOrder: boolean;
  lostReason: string | null;
}

export interface LeadQueryResult {
  rows: LeadRow[];
  totalValueRupees: number;
  cohortLabel: string;
  cohortDescription: string;
}

const COLD_DAYS = 7;

/**
 * Cohort predicates. Deliberately evaluated against the *unwindowed* branch-scoped pool, matching
 * the alert feed's own scope (FR-009): a reader arriving here from an alert must see exactly the
 * records that alert counted, and a time filter must never silently remove some of them.
 */
function matchesCohort(lead: LeadRow, cohort: LeadCohort): boolean {
  switch (cohort) {
    case "all":
      return true;
    case "never_contacted":
      return !lead.wasContacted;
    case "no_test_drive":
      return lead.wasContacted && !lead.tookTestDrive;
    case "stuck_orders":
      return lead.isStuckOrder;
    case "cold":
      return lead.isOpen && lead.daysSinceActivity >= COLD_DAYS;
    case "open":
      return lead.isOpen;
    case "lost":
      return lead.status === "lost";
    case "delivered":
      return lead.currentStage === "delivered" && lead.status !== "lost";
  }
}

export function queryLeads(ctx: AnalyticsContext, query: LeadQuery): LeadQueryResult {
  const idSet = query.ids && query.ids.length > 0 ? new Set(query.ids) : null;

  let rows: LeadRow[] = ctx.detectionLeads.map((l) => ({
    leadId: l.id,
    customerName: l.customerName,
    phone: l.phone,
    branchId: l.branchId,
    branchName: l.branch.name,
    repId: l.assignedTo,
    repName: l.rep.name,
    model: l.modelInterested,
    source: l.source,
    status: l.status,
    currentStage: l.currentStage,
    dealValueRupees: l.dealValue,
    ageDays: l.ageDays,
    daysSinceActivity: l.daysSinceActivity,
    daysSinceOrder: l.daysSinceOrder,
    wasContacted: l.wasContacted,
    tookTestDrive: l.tookTestDrive,
    isOpen: l.isOpen,
    isStuckOrder: l.isStuckOrder,
    lostReason: l.lostReason,
  }));

  if (idSet) rows = rows.filter((r) => idSet.has(r.leadId));
  rows = rows.filter((r) => matchesCohort(r, query.cohort));
  if (query.branchId) rows = rows.filter((r) => r.branchId === query.branchId);
  if (query.repId) rows = rows.filter((r) => r.repId === query.repId);
  if (query.model) rows = rows.filter((r) => r.model === query.model);
  if (query.source) rows = rows.filter((r) => r.source === query.source);
  if (query.stage) rows = rows.filter((r) => r.currentStage === query.stage);

  const dir = query.dir ?? "desc";
  const sortKey = query.sort ?? "value";
  const mult = dir === "desc" ? -1 : 1;
  const STAGE_ORDER: Stage[] = [
    "new",
    "contacted",
    "test_drive",
    "negotiation",
    "order_placed",
    "delivered",
  ];
  rows.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "value":
        cmp = a.dealValueRupees - b.dealValueRupees;
        break;
      case "age":
        cmp = a.ageDays - b.ageDays;
        break;
      case "idle":
        cmp = a.daysSinceActivity - b.daysSinceActivity;
        break;
      case "customer":
        cmp = a.customerName.localeCompare(b.customerName);
        break;
      case "stage":
        cmp = STAGE_ORDER.indexOf(a.currentStage) - STAGE_ORDER.indexOf(b.currentStage);
        break;
    }
    // Stable, total order: lead id breaks every tie so repeated renders never reshuffle.
    if (cmp !== 0) return cmp * mult;
    return a.leadId.localeCompare(b.leadId);
  });

  const meta = LEAD_COHORTS.find((c) => c.key === query.cohort);
  return {
    rows,
    totalValueRupees: rows.reduce((s, r) => s + r.dealValueRupees, 0),
    cohortLabel: meta?.label ?? "Leads",
    cohortDescription: meta?.description ?? "",
  };
}
