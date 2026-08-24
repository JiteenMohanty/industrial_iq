import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import {
  GROUP_FUNNEL,
  TOTAL_LEADS,
  TOTAL_BRANCHES,
  TOTAL_REPS,
  TOTAL_TARGETS,
  TOTAL_DELIVERIES,
  DATA_AS_OF_ISO,
  MIN_CREATED_AT_ISO,
  STUCK_ORDERS_ALL,
  TOTAL_LOSSES,
  RAW_STATUS_LOST_COUNT,
} from "../fixtures";

describe("dataset", () => {
  const dataset = getDataset();

  it("loads every record", () => {
    expect(dataset.leads).toHaveLength(TOTAL_LEADS);
    expect(dataset.branches).toHaveLength(TOTAL_BRANCHES);
    expect(dataset.reps).toHaveLength(TOTAL_REPS);
    expect(dataset.targets).toHaveLength(TOTAL_TARGETS);
    expect(dataset.deliveries).toHaveLength(TOTAL_DELIVERIES);
  });

  it("computes DATA_AS_OF as the max lead timestamp, not metadata.generated_at", () => {
    expect(dataset.dataAsOf.toISOString()).toBe(DATA_AS_OF_ISO);
  });

  it("computes minCreatedAt as the earliest lead created_at", () => {
    expect(dataset.minCreatedAt.toISOString()).toBe(MIN_CREATED_AT_ISO);
  });

  it("reproduces the group funnel from reachedStages, not current status", () => {
    const count = (stage: keyof typeof GROUP_FUNNEL) =>
      dataset.leads.filter((l) => l.reachedStages.has(stage)).length;

    expect(count("new")).toBe(GROUP_FUNNEL.new);
    expect(count("contacted")).toBe(GROUP_FUNNEL.contacted);
    expect(count("test_drive")).toBe(GROUP_FUNNEL.test_drive);
    expect(count("negotiation")).toBe(GROUP_FUNNEL.negotiation);
    expect(count("order_placed")).toBe(GROUP_FUNNEL.order_placed);
    expect(count("delivered")).toBe(GROUP_FUNNEL.delivered);
  });

  it("counts all 38 stuck orders (order_placed with no delivery, not lost)", () => {
    const stuck = dataset.leads.filter((l) => l.isStuckOrder);
    expect(stuck).toHaveLength(STUCK_ORDERS_ALL.count);
    const totalValue = stuck.reduce((sum, l) => sum + l.dealValue, 0);
    expect(totalValue).toBe(STUCK_ORDERS_ALL.valueRupees);
  });

  it("indexes resolve for every lead", () => {
    for (const lead of dataset.leads) {
      expect(dataset.leadById.get(lead.id)).toBe(lead);
      expect(dataset.branchById.has(lead.branchId)).toBe(true);
      expect(dataset.repById.has(lead.assignedTo)).toBe(true);
    }
  });

  it("leadsByBranch and leadsByRep partition every lead exactly once", () => {
    const byBranchTotal = Array.from(dataset.leadsByBranch.values()).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    const byRepTotal = Array.from(dataset.leadsByRep.values()).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(byBranchTotal).toBe(TOTAL_LEADS);
    expect(byRepTotal).toBe(TOTAL_LEADS);
  });

  it("every delivered lead has a delivery record, and every delivery resolves back to a lead", () => {
    const delivered = dataset.leads.filter((l) => l.reachedStages.has("delivered"));
    expect(delivered).toHaveLength(TOTAL_DELIVERIES);
    for (const lead of delivered) {
      expect(lead.delivery).not.toBeNull();
      expect(lead.delivery?.lead).toBe(lead);
    }
  });

  it("first-occurrence stageTimestamps survive re-entry (first wins, not last)", () => {
    for (const lead of dataset.leads) {
      for (const stage of lead.reachedStages) {
        const firstInHistory = lead.statusHistory.find((e) => e.status === stage);
        expect(lead.stageTimestamps[stage]?.toISOString()).toBe(
          firstInHistory ? new Date(firstInHistory.timestamp).toISOString() : undefined,
        );
      }
    }
  });

  it("status_history is sorted ascending for every lead", () => {
    for (const lead of dataset.leads) {
      for (let i = 1; i < lead.statusHistory.length; i++) {
        const prevEntry = lead.statusHistory[i - 1];
        const currEntry = lead.statusHistory[i];
        expect(prevEntry).toBeDefined();
        expect(currEntry).toBeDefined();
        if (prevEntry && currEntry) {
          expect(Date.parse(prevEntry.timestamp)).toBeLessThanOrEqual(
            Date.parse(currEntry.timestamp),
          );
        }
      }
    }
  });

  it("isLost is derived from status_history containing a 'lost' entry, not the raw status field", () => {
    // 14 leads carry raw status: "lost" with no "lost" entry in status_history and
    // lost_reason: null on every one — Constitution III requires status_history to win, so these
    // are correctly NOT lost. This is the regression guard for that finding (decision-log.md).
    const trueLost = dataset.leads.filter((l) => l.isLost);
    expect(trueLost).toHaveLength(TOTAL_LOSSES);
    expect(trueLost.length).toBeLessThan(RAW_STATUS_LOST_COUNT);
    for (const lead of trueLost) {
      expect(lead.statusHistory.some((h) => h.status === "lost")).toBe(true);
    }
  });

  it("EnrichedLead.status is always internally consistent with isLost/currentStage", () => {
    for (const lead of dataset.leads) {
      if (lead.isLost) {
        expect(lead.status).toBe("lost");
      } else {
        expect(lead.status).toBe(lead.currentStage);
      }
    }
  });

  it("months are derived from targets, ascending, one per branch-month", () => {
    expect(dataset.months).toEqual([
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
  });
});
