import { describe, it, expect } from "vitest";
import {
  computeDeliveryOps,
  computeDelayReasons,
  computeDeliveryByBranch,
} from "@/lib/analytics/deliveries";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { DELIVERY_OPS } from "../fixtures";

function fullContext() {
  const dataset = getDataset();
  return buildContext(parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset)));
}

describe("computeDeliveryOps", () => {
  it("reproduces the verified average/min/max days to deliver and delay count", () => {
    const ops = computeDeliveryOps(fullContext());
    expect(ops.avgDays).toBeCloseTo(DELIVERY_OPS.avgDays, 1);
    expect(ops.minDays).toBe(DELIVERY_OPS.minDays);
    expect(ops.maxDays).toBe(DELIVERY_OPS.maxDays);
    expect(ops.delayedCount).toBe(DELIVERY_OPS.delayedCount);
    expect(ops.totalCount).toBe(DELIVERY_OPS.totalCount);
  });
});

describe("computeDelayReasons", () => {
  it("buckets delayed deliveries by reason, summing to the delayed count", () => {
    const reasons = computeDelayReasons(fullContext());
    const total = reasons.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(DELIVERY_OPS.delayedCount);
  });

  it("every bucket has a non-empty reason label and a positive count", () => {
    const reasons = computeDelayReasons(fullContext());
    for (const r of reasons) {
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.count).toBeGreaterThan(0);
    }
  });
});

describe("computeDeliveryByBranch", () => {
  it("covers all 5 branches with a valid average days figure", () => {
    const byBranch = computeDeliveryByBranch(fullContext());
    expect(byBranch).toHaveLength(5);
    for (const b of byBranch) {
      expect(b.deliveredCount).toBeGreaterThan(0);
      expect(b.avgDays).toBeGreaterThan(0);
    }
  });
});
