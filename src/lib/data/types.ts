// Closed domains — string-literal unions, never `string`, so a rule predicate typo fails to
// compile rather than silently matching nothing (Constitution II).

export type Stage =
  | "new"
  | "contacted"
  | "test_drive"
  | "negotiation"
  | "order_placed"
  | "delivered";

export type LeadStatus = Stage | "lost";

export type Source =
  | "walk_in"
  | "website"
  | "phone_enquiry"
  | "referral"
  | "social_media"
  | "auto_expo";

export type RepRole = "branch_manager" | "sales_officer";

export type Severity = "critical" | "warning" | "info";

// Ordered — the single source of stage ordering. `lost` is deliberately excluded: a lead exits
// the funnel sideways from whichever stage it reached, so `lost` has no position in it.
export const FUNNEL_STAGES: readonly Stage[] = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
  "order_placed",
  "delivered",
] as const;

// ---------------------------------------------------------------------------------------------
// Raw types — mirror dealership_data.json exactly. Never used beyond the dataset.ts parse
// boundary; every raw snake_case field is renamed to camelCase on the way into an enriched type.
// ---------------------------------------------------------------------------------------------

export interface RawBranch {
  id: string;
  name: string;
  city: string;
}

export interface RawRep {
  id: string;
  name: string;
  branch_id: string;
  role: RepRole;
  joined: string;
}

export interface RawStatusEntry {
  status: LeadStatus;
  timestamp: string;
  note: string;
}

export interface RawLead {
  id: string;
  customer_name: string;
  phone: string;
  source: Source;
  model_interested: string;
  status: LeadStatus;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  status_history: RawStatusEntry[];
  expected_close_date: string;
  deal_value: number;
  lost_reason: string | null;
}

export interface RawTarget {
  branch_id: string;
  month: string; // "YYYY-MM"
  target_units: number;
  target_revenue: number;
}

export interface RawDelivery {
  lead_id: string;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: string | null;
}

export interface RawMetadata {
  generated_at: string;
  description: string;
  date_range: string;
  notes: string;
}

export interface RawDataset {
  metadata: RawMetadata;
  branches: RawBranch[];
  sales_reps: RawRep[];
  leads: RawLead[];
  targets: RawTarget[];
  deliveries: RawDelivery[];
}

// ---------------------------------------------------------------------------------------------
// Enriched types — produced once by dataset.ts. Everything analytics/insights code sees.
// ---------------------------------------------------------------------------------------------

export interface Branch {
  id: string;
  name: string;
  city: string;
  label: string; // "Lakeside Toyota (Bangalore)"
}

export interface Rep {
  id: string;
  name: string;
  branchId: string;
  role: RepRole;
  joined: string;
  branch: Branch;
}

export interface EnrichedDelivery {
  leadId: string;
  orderDate: Date;
  deliveryDate: Date;
  deliveryMonth: string; // "YYYY-MM", derived from deliveryDate
  daysToDeliver: number;
  delayReason: string | null;
  isDelayed: boolean;
  lead: EnrichedLead;
}

export interface EnrichedLead {
  id: string;
  customerName: string;
  phone: string;
  source: Source;
  modelInterested: string;
  status: LeadStatus;
  assignedTo: string;
  branchId: string;
  statusHistory: RawStatusEntry[]; // sorted ascending by timestamp
  expectedCloseDate: string;
  dealValue: number;
  lostReason: string | null;

  // Derived — status_history is the authority; `status` alone is never used for stage logic
  // (Constitution III, FR-017).
  stageTimestamps: Partial<Record<Stage, Date>>;
  reachedStages: Set<Stage>;
  currentStage: Stage;
  isLost: boolean;
  lostFromStage: Stage | null;
  isOpen: boolean;
  isStuckOrder: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  ageDays: number;
  daysSinceActivity: number;
  daysSinceOrder: number | null;

  // --- Second-pass additions (v2). The EDA established that the funnel is strictly sequential
  // and that the test drive is an absolute gate: across all 510 leads, zero skipped a stage and
  // zero of the 91 contacted-but-never-test-driven leads ever reached delivery. `wasContacted`
  // and `tookTestDrive` are therefore first-class fields, not ad-hoc `reachedStages.has(...)`
  // calls scattered through the analytics layer.
  wasContacted: boolean;
  tookTestDrive: boolean;
  /** Full sales cycle in days, lead creation -> delivery. Null unless delivered. */
  cycleDays: number | null;
  expectedCloseAt: Date;
  /** Delivered date minus promised close date. Positive = late. Null unless delivered. */
  closeSlipDays: number | null;
  delivery: EnrichedDelivery | null;
  branch: Branch;
  rep: Rep;
}

export interface Dataset {
  leads: EnrichedLead[];
  deliveries: EnrichedDelivery[];
  branches: Branch[];
  reps: Rep[];
  targets: RawTarget[];
  dataAsOf: Date;
  minCreatedAt: Date;
  months: readonly string[]; // "YYYY-MM", every month present in `targets`, ascending
  models: readonly string[]; // every distinct model_interested, by descending lead volume
  sources: readonly Source[]; // every distinct source, by descending lead volume

  leadById: ReadonlyMap<string, EnrichedLead>;
  leadsByBranch: ReadonlyMap<string, EnrichedLead[]>;
  leadsByRep: ReadonlyMap<string, EnrichedLead[]>;
  leadsByModel: ReadonlyMap<string, EnrichedLead[]>;
  leadsBySource: ReadonlyMap<Source, EnrichedLead[]>;
  deliveryByLeadId: ReadonlyMap<string, EnrichedDelivery>;
  targetsByBranchMonth: ReadonlyMap<string, RawTarget>;
  repById: ReadonlyMap<string, Rep>;
  branchById: ReadonlyMap<string, Branch>;
}
