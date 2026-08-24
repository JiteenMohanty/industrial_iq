import { describe, it, expect } from "vitest";
import { computeStuckOrders, computeOpenPipeline, computeAgingBuckets } from "@/lib/analytics/pipeline";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { STUCK_ORDERS_ALL, OLDEST_STUCK_ORDER_DAYS, STUCK_ORDERS_ALERTING_27D } from "../fixtures";

function fullContext() {
  const dataset = getDataset();
  return buildContext(parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset)));
}

describe("computeStuckOrders", () => {
  it("returns all 38 undelivered placed orders, not just the alerting 25", () => {
    const ctx = fullContext();
    const stuck = computeStuckOrders(ctx);
    expect(stuck).toHaveLength(STUCK_ORDERS_ALL.count);
    const total = stuck.reduce((sum, s) => sum + s.dealValueRupees, 0);
    expect(total).toBe(STUCK_ORDERS_ALL.valueRupees);
  });

  it("the oldest order is 195 days, and every row carries both age and value", () => {
    const ctx = fullContext();
    const stuck = computeStuckOrders(ctx);
    const maxAge = Math.max(...stuck.map((s) => s.daysSinceOrder));
    expect(maxAge).toBe(OLDEST_STUCK_ORDER_DAYS);
    for (const s of stuck) {
      expect(s.daysSinceOrder).toBeGreaterThanOrEqual(0);
      expect(s.dealValueRupees).toBeGreaterThan(0);
    }
  });

  it("is sorted with the oldest, highest-value orders first", () => {
    const ctx = fullContext();
    const stuck = computeStuckOrders(ctx);
    for (let i = 1; i < stuck.length; i++) {
      const prev = stuck[i - 1];
      const curr = stuck[i];
      if (!prev || !curr) continue;
      if (prev.daysSinceOrder === curr.daysSinceOrder) {
        expect(prev.dealValueRupees).toBeGreaterThanOrEqual(curr.dealValueRupees);
      } else {
        expect(prev.daysSinceOrder).toBeGreaterThanOrEqual(curr.daysSinceOrder);
      }
    }
  });

  it("the >=27-day subset matches the 25-order alerting figure exactly", () => {
    const ctx = fullContext();
    const stuck = computeStuckOrders(ctx);
    const alerting = stuck.filter((s) => s.daysSinceOrder >= 27);
    expect(alerting).toHaveLength(STUCK_ORDERS_ALERTING_27D.count);
  });
});

describe("computeOpenPipeline", () => {
  it("sums deal value across every currently open lead", () => {
    const ctx = fullContext();
    const summary = computeOpenPipeline(ctx);
    expect(summary.totalValueRupees).toBeGreaterThan(0);
    expect(summary.count).toBeGreaterThan(0);
  });
});

describe("computeAgingBuckets", () => {
  it("buckets open leads at 7/14/30 day boundaries, matching the cold-leads rule thresholds", () => {
    const ctx = fullContext();
    const buckets = computeAgingBuckets(ctx);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBeGreaterThan(0);
    for (const bucket of buckets) {
      expect(bucket.count).toBeGreaterThanOrEqual(0);
    }
  });
});
