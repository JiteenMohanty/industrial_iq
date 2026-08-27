import type { AnalyticsContext } from "./context";
import type { EnrichedLead } from "@/lib/data/types";

/**
 * Gate analysis — the product's central diagnostic.
 *
 * Two facts about this dataset, both verified across all 510 leads and both asserted in
 * `tests/analytics/gates.spec.ts`, make this the right frame for the whole dashboard:
 *
 *   1. The funnel is strictly sequential. Not one lead skips a stage.
 *   2. The test drive is an absolute gate. Of the 391 leads that were contacted, 91 never took a
 *      test drive — and *zero* of those 91 reached negotiation, an order, or a delivery.
 *
 * Together those mean every lead that fails to reach a test drive is a guaranteed zero, not a
 * lower-probability opportunity. So the business is decided at two gates that both sit before any
 * negotiating skill matters: did we call them, and did we get them into a car. Everything
 * downstream operates on a pool that these two gates have already fixed the size of.
 */
export interface GateStep {
  /** Machine key, used for chart series identity and hrefs. */
  key: "contact" | "test_drive" | "close";
  label: string;
  /** Leads entering this gate. */
  entered: number;
  /** Leads that passed through it. */
  passed: number;
  /** Leads that died here. */
  lost: number;
  passRatePct: number | null;
  /** Deal value of the leads that died at this gate. */
  lostValueRupees: number;
  /** Plain-English statement of what the gate is, shown in the UI beside the figure. */
  description: string;
}

export interface GateAnalysis {
  totalLeads: number;
  steps: GateStep[];
  /** Leads lost before ever reaching a test drive (gate 1 + gate 2). */
  preTestDriveLost: number;
  preTestDriveLostValueRupees: number;
  preTestDriveLostSharePct: number | null;
  /** Leads that took a test drive. */
  testDriven: number;
  /** Of those, how many were delivered. */
  testDrivenDelivered: number;
  testDrivenConversionPct: number | null;
  /**
   * The proof the gate is absolute, carried alongside the claim so the UI never asserts it
   * without the evidence: how many contacted-but-never-test-driven leads were ever delivered.
   * This is 0 on the shipped dataset and the UI states the figure rather than the adjective.
   */
  noTestDriveDelivered: number;
  noTestDriveCount: number;
  /** Evidence sets, for drill-through and call lists. */
  neverContactedIds: string[];
  noTestDriveIds: string[];
}

const sumValue = (leads: readonly EnrichedLead[]): number =>
  leads.reduce((sum, l) => sum + l.dealValue, 0);

const rate = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : (numerator / denominator) * 100;

/**
 * Computes the gates over an explicit lead pool. Callers pass the scope they mean — the Overview
 * uses `groupLeads` (whole business, unfiltered, so the headline never shrinks because a reader
 * picked a narrow month), a branch page passes that branch's leads. Keeping the pool an argument
 * rather than reading a fixed scope off `ctx` is what lets one function serve both without the
 * scope-confusion bug ADR-0005 exists to prevent.
 */
export function computeGatesFor(leads: readonly EnrichedLead[]): GateAnalysis {
  const total = leads.length;

  const contacted = leads.filter((l) => l.wasContacted);
  const neverContacted = leads.filter((l) => !l.wasContacted);

  const testDriven = contacted.filter((l) => l.tookTestDrive);
  const noTestDrive = contacted.filter((l) => !l.tookTestDrive);

  const delivered = testDriven.filter((l) => l.reachedStages.has("delivered"));
  const notClosed = testDriven.filter((l) => !l.reachedStages.has("delivered"));

  const steps: GateStep[] = [
    {
      key: "contact",
      label: "Contact",
      entered: total,
      passed: contacted.length,
      lost: neverContacted.length,
      passRatePct: rate(contacted.length, total),
      lostValueRupees: sumValue(neverContacted),
      description: "Leads that reached the contacted stage at least once.",
    },
    {
      key: "test_drive",
      label: "Test drive",
      entered: contacted.length,
      passed: testDriven.length,
      lost: noTestDrive.length,
      passRatePct: rate(testDriven.length, contacted.length),
      lostValueRupees: sumValue(noTestDrive),
      description: "Contacted leads that got into a car. No lead has ever bought without this.",
    },
    {
      key: "close",
      label: "Close",
      entered: testDriven.length,
      passed: delivered.length,
      lost: notClosed.length,
      passRatePct: rate(delivered.length, testDriven.length),
      lostValueRupees: sumValue(notClosed),
      description: "Test-driven leads that reached delivery — negotiation, order and handover.",
    },
  ];

  const preLost = neverContacted.length + noTestDrive.length;

  return {
    totalLeads: total,
    steps,
    preTestDriveLost: preLost,
    preTestDriveLostValueRupees: sumValue(neverContacted) + sumValue(noTestDrive),
    preTestDriveLostSharePct: rate(preLost, total),
    testDriven: testDriven.length,
    testDrivenDelivered: delivered.length,
    testDrivenConversionPct: rate(delivered.length, testDriven.length),
    noTestDriveDelivered: noTestDrive.filter((l) => l.reachedStages.has("delivered")).length,
    noTestDriveCount: noTestDrive.length,
    neverContactedIds: neverContacted.map((l) => l.id),
    noTestDriveIds: noTestDrive.map((l) => l.id),
  };
}

/**
 * Group-wide gates, always measured on the unfiltered dataset.
 *
 * Deliberately not window-scoped, for the same reason problem detection isn't (FR-009): the gate
 * story is a structural fact about how this business loses money, and a reader selecting "last 30
 * days" must not be shown a version of it that looks smaller than it is. Branch scoping is
 * offered explicitly through `computeGatesFor`.
 */
export function computeGates(ctx: AnalyticsContext): GateAnalysis {
  return computeGatesFor(ctx.groupLeads);
}

export interface BranchGateRow {
  branchId: string;
  branchName: string;
  branchLabel: string;
  leads: number;
  contactRatePct: number | null;
  testDriveRatePct: number | null;
  closeRatePct: number | null;
  /** Overall lead -> delivered. */
  conversionPct: number | null;
  preTestDriveLostValueRupees: number;
}

/** Per-branch view of the same three gates — the comparison behind the Overview's branch table. */
export function computeBranchGates(ctx: AnalyticsContext): BranchGateRow[] {
  return ctx.dataset.branches.map((branch) => {
    const leads = ctx.dataset.leadsByBranch.get(branch.id) ?? [];
    const g = computeGatesFor(leads);
    const delivered = leads.filter((l) => l.reachedStages.has("delivered")).length;
    return {
      branchId: branch.id,
      branchName: branch.name,
      branchLabel: branch.label,
      leads: leads.length,
      contactRatePct: g.steps[0]?.passRatePct ?? null,
      testDriveRatePct: g.steps[1]?.passRatePct ?? null,
      closeRatePct: g.steps[2]?.passRatePct ?? null,
      conversionPct: rate(delivered, leads.length),
      preTestDriveLostValueRupees: g.preTestDriveLostValueRupees,
    };
  });
}
