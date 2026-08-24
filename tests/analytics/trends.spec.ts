import { describe, it, expect } from "vitest";
import { computeMonthlyTrend } from "@/lib/analytics/trends";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { DELIVERIES_BY_MONTH } from "../fixtures";

describe("computeMonthlyTrend", () => {
  it("reproduces the verified deliveries-by-month figures, unaffected by the active filter", () => {
    const dataset = getDataset();
    // Deliberately narrow filters — trend is always full-range so the shape of growth is visible.
    const filters = parseFilters(
      new URLSearchParams({ preset: "month", month: "2025-06" }),
      buildParseFiltersContext(dataset),
    );
    const trend = computeMonthlyTrend(buildContext(filters));
    for (const [month, expected] of Object.entries(DELIVERIES_BY_MONTH)) {
      const point = trend.find((p) => p.month === month);
      expect(point?.deliveredUnits).toBe(expected);
    }
  });

  it("covers every month in the dataset, ascending", () => {
    const dataset = getDataset();
    const filters = parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset));
    const trend = computeMonthlyTrend(buildContext(filters));
    expect(trend.map((p) => p.month)).toEqual(dataset.months);
  });
});
