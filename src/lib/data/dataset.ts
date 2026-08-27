import "server-only";
import { cache } from "react";
import rawDataJson from "@/data/dealership_data.json";
import type {
  RawDataset,
  RawLead,
  RawStatusEntry,
  RawBranch,
  RawRep,
  RawDelivery,
  EnrichedLead,
  EnrichedDelivery,
  Branch,
  Rep,
  Dataset,
  Stage,
  Source,
} from "./types";
import { FUNNEL_STAGES } from "./types";
import { computeDataAsOf, daysBetween, toMonthKey } from "@/lib/time";

const rawData = rawDataJson as unknown as RawDataset;

function buildBranches(raw: readonly RawBranch[]): Branch[] {
  return raw.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    label: `${b.name} (${b.city})`,
  }));
}

function buildReps(raw: readonly RawRep[], branchById: ReadonlyMap<string, Branch>): Rep[] {
  return raw.map((r) => {
    const branch = branchById.get(r.branch_id);
    if (!branch) {
      throw new Error(`Ingest error: rep ${r.id} references unknown branch ${r.branch_id}`);
    }
    return {
      id: r.id,
      name: r.name,
      branchId: r.branch_id,
      role: r.role,
      joined: r.joined,
      branch,
    };
  });
}

function sortedHistory(history: readonly RawStatusEntry[]): RawStatusEntry[] {
  return [...history].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

interface StageInfo {
  stageTimestamps: Partial<Record<Stage, Date>>;
  reachedStages: Set<Stage>;
  currentStage: Stage;
  isLost: boolean;
  lostFromStage: Stage | null;
}

/** First occurrence per stage wins — re-entry into a stage must not reset its clock. */
function deriveStageInfo(history: readonly RawStatusEntry[]): StageInfo {
  const stageTimestamps: Partial<Record<Stage, Date>> = {};
  const reachedStages = new Set<Stage>();
  let isLost = false;
  let lostFromStage: Stage | null = null;

  history.forEach((entry, i) => {
    if (entry.status === "lost") {
      isLost = true;
      const prev = history[i - 1];
      lostFromStage = prev ? (prev.status as Stage) : null;
      return;
    }
    const stage = entry.status;
    if (stageTimestamps[stage] === undefined) {
      stageTimestamps[stage] = new Date(entry.timestamp);
    }
    reachedStages.add(stage);
  });

  let currentStage: Stage = "new";
  for (const stage of FUNNEL_STAGES) {
    if (reachedStages.has(stage)) currentStage = stage;
  }

  return { stageTimestamps, reachedStages, currentStage, isLost, lostFromStage };
}

function assertIngestInvariants(
  leads: readonly RawLead[],
  deliveries: readonly RawDelivery[],
): void {
  const deliveryByLeadId = new Map(deliveries.map((d) => [d.lead_id, d]));

  for (const lead of leads) {
    if (lead.status_history.length === 0) {
      throw new Error(`Ingest error: lead ${lead.id} has empty status_history`);
    }
    const sorted = sortedHistory(lead.status_history);
    const firstEntry = sorted[0];
    if (!firstEntry || firstEntry.status !== "new") {
      throw new Error(
        `Ingest error: lead ${lead.id} does not start at 'new' ` +
          `(starts at '${firstEntry?.status ?? "nothing"}')`,
      );
    }
    if (lead.status === "delivered" && !deliveryByLeadId.has(lead.id)) {
      throw new Error(`Ingest error: lead ${lead.id} is delivered but has no delivery record`);
    }
    if (lead.status === "order_placed" && deliveryByLeadId.has(lead.id)) {
      throw new Error(
        `Ingest error: lead ${lead.id} is order_placed but already has a delivery record`,
      );
    }
  }

  for (const delivery of deliveries) {
    const computedDays = daysBetween(
      new Date(delivery.order_date),
      new Date(delivery.delivery_date),
    );
    if (computedDays !== delivery.days_to_deliver) {
      throw new Error(
        `Ingest error: delivery for lead ${delivery.lead_id} states ` +
          `days_to_deliver=${delivery.days_to_deliver} but dates imply ${computedDays}`,
      );
    }
  }
}

function buildDataset(): Dataset {
  assertIngestInvariants(rawData.leads, rawData.deliveries);

  const dataAsOf = computeDataAsOf(rawData.leads);

  const branches = buildBranches(rawData.branches);
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const reps = buildReps(rawData.sales_reps, branchById);
  const repById = new Map(reps.map((r) => [r.id, r]));

  const rawDeliveryByLeadId = new Map(rawData.deliveries.map((d) => [d.lead_id, d]));

  // Pass 1: build every lead. `delivery` is patched in during pass 2, once EnrichedDelivery
  // objects (which back-reference the lead) exist to point at.
  const leads: EnrichedLead[] = rawData.leads.map((raw) => {
    const branch = branchById.get(raw.branch_id);
    if (!branch) {
      throw new Error(`Ingest error: lead ${raw.id} references unknown branch ${raw.branch_id}`);
    }
    const rep = repById.get(raw.assigned_to);
    if (!rep) {
      throw new Error(`Ingest error: lead ${raw.id} references unknown rep ${raw.assigned_to}`);
    }

    const statusHistory = sortedHistory(raw.status_history);
    const { stageTimestamps, reachedStages, currentStage, isLost, lostFromStage } =
      deriveStageInfo(statusHistory);

    const createdAt = new Date(raw.created_at);
    const lastActivityAt = new Date(raw.last_activity_at);
    const hasDeliveryRecord = rawDeliveryByLeadId.has(raw.id);
    const isOpen = !isLost && !reachedStages.has("delivered");
    const isStuckOrder = reachedStages.has("order_placed") && !hasDeliveryRecord && !isLost;
    const orderPlacedAt = stageTimestamps.order_placed ?? null;

    // The test drive is an absolute gate in this dataset: of 391 contacted leads, the 91 that
    // never took a test drive produced zero deliveries. Surfaced as a first-class field because
    // it drives the product's central diagnosis, not as an incidental stage lookup.
    const deliveredAt = stageTimestamps.delivered ?? null;
    const expectedCloseAt = new Date(raw.expected_close_date);

    return {
      id: raw.id,
      customerName: raw.customer_name,
      phone: raw.phone,
      source: raw.source,
      modelInterested: raw.model_interested,
      // Derived from status_history, NOT copied from raw.status: 14 leads in this dataset carry
      // status: "lost" with no corresponding "lost" entry anywhere in their status_history (and
      // lost_reason: null on every one) — a data-generation artifact. Constitution III requires
      // status_history to win; see decision-log.md for the full investigation.
      status: isLost ? "lost" : currentStage,
      assignedTo: raw.assigned_to,
      branchId: raw.branch_id,
      statusHistory,
      expectedCloseDate: raw.expected_close_date,
      dealValue: raw.deal_value,
      lostReason: raw.lost_reason,
      stageTimestamps,
      reachedStages,
      currentStage,
      isLost,
      lostFromStage,
      isOpen,
      isStuckOrder,
      createdAt,
      lastActivityAt,
      ageDays: daysBetween(createdAt, dataAsOf),
      daysSinceActivity: daysBetween(lastActivityAt, dataAsOf),
      daysSinceOrder: orderPlacedAt ? daysBetween(orderPlacedAt, dataAsOf) : null,
      wasContacted: reachedStages.has("contacted"),
      tookTestDrive: reachedStages.has("test_drive"),
      cycleDays: deliveredAt ? daysBetween(createdAt, deliveredAt) : null,
      expectedCloseAt,
      closeSlipDays: deliveredAt ? daysBetween(expectedCloseAt, deliveredAt) : null,
      delivery: null,
      branch,
      rep,
    };
  });

  const leadById = new Map(leads.map((l) => [l.id, l]));

  // Pass 2: build deliveries (referencing the already-built leads), then patch each lead's
  // `delivery` back-reference now that the EnrichedDelivery objects exist.
  const deliveries: EnrichedDelivery[] = rawData.deliveries.map((raw) => {
    const lead = leadById.get(raw.lead_id);
    if (!lead) {
      throw new Error(`Ingest error: delivery references unknown lead ${raw.lead_id}`);
    }
    const deliveryDate = new Date(raw.delivery_date);
    return {
      leadId: raw.lead_id,
      orderDate: new Date(raw.order_date),
      deliveryDate,
      deliveryMonth: toMonthKey(deliveryDate),
      daysToDeliver: raw.days_to_deliver,
      delayReason: raw.delay_reason,
      isDelayed: raw.delay_reason !== null,
      lead,
    };
  });

  const deliveryByLeadId = new Map(deliveries.map((d) => [d.leadId, d]));
  for (const lead of leads) {
    const delivery = deliveryByLeadId.get(lead.id);
    if (delivery) {
      lead.delivery = delivery;
    }
  }

  const leadsByBranch = new Map<string, EnrichedLead[]>();
  const leadsByRep = new Map<string, EnrichedLead[]>();
  const leadsByModel = new Map<string, EnrichedLead[]>();
  const leadsBySource = new Map<Source, EnrichedLead[]>();
  for (const lead of leads) {
    const branchList = leadsByBranch.get(lead.branchId) ?? [];
    branchList.push(lead);
    leadsByBranch.set(lead.branchId, branchList);

    const repList = leadsByRep.get(lead.assignedTo) ?? [];
    repList.push(lead);
    leadsByRep.set(lead.assignedTo, repList);

    const modelList = leadsByModel.get(lead.modelInterested) ?? [];
    modelList.push(lead);
    leadsByModel.set(lead.modelInterested, modelList);

    const sourceList = leadsBySource.get(lead.source) ?? [];
    sourceList.push(lead);
    leadsBySource.set(lead.source, sourceList);
  }

  // Ordered by descending lead volume so every model/source axis in the product renders in the
  // same, stable order without each call site re-sorting.
  const models = [...leadsByModel.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([m]) => m);
  const sources = [...leadsBySource.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([sc]) => sc);

  const targetsByBranchMonth = new Map(
    rawData.targets.map((t) => [`${t.branch_id}:${t.month}`, t]),
  );

  const minCreatedAt = new Date(Math.min(...leads.map((l) => l.createdAt.getTime())));
  const months = Array.from(new Set(rawData.targets.map((t) => t.month))).sort();

  Object.freeze(leads);
  Object.freeze(deliveries);
  Object.freeze(branches);
  Object.freeze(reps);
  Object.freeze(months);
  Object.freeze(models);
  Object.freeze(sources);

  return {
    leads,
    deliveries,
    branches,
    reps,
    targets: rawData.targets,
    dataAsOf,
    minCreatedAt,
    months,
    models,
    sources,
    leadById,
    leadsByBranch,
    leadsByRep,
    leadsByModel,
    leadsBySource,
    deliveryByLeadId,
    targetsByBranchMonth,
    repById,
    branchById,
  };
}

// True once-per-process memoisation. React's `cache()` alone only dedupes *within* a single
// request — it does not share results across requests — so without this module-level singleton
// underneath it, the 620 KB dataset would be re-parsed and re-enriched on every request, which is
// exactly what ADR-0003 exists to prevent. `cache()` on top gives the React-idiomatic per-request
// dedup so multiple Server Components calling getDataset() in one render only touch the singleton
// once each.
let cachedDataset: Dataset | null = null;

export const getDataset = cache((): Dataset => {
  if (!cachedDataset) {
    cachedDataset = buildDataset();
  }
  return cachedDataset;
});
