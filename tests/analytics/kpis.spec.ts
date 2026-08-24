import { describe, it, expect } from "vitest";
import { computeKpis } from "@/lib/analytics/kpis";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import {
  TOTAL_DELIVERIES,
  DELIVERED_REVENUE_RUPEES,
  GROUP_ATTAINMENT_UNITS_PCT,
  OPEN_PIPELINE_VALUE_RUPEES,
  GROUP_CONVERSION_RATE_PCT,
} from "../fixtures";

function fullFilters() {
  const dataset = getDataset();
  return parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset));
}

describe("computeKpis", () => {
  it("reproduces the verified full-range figures exactly", () => {
    const kpis = computeKpis(buildContext(fullFilters()));
    expect(kpis.deliveredUnits.value).toBe(TOTAL_DELIVERIES);
    expect(kpis.deliveredRevenue.value).toBe(DELIVERED_REVENUE_RUPEES);
    expect(kpis.attainment.value).toBeCloseTo(GROUP_ATTAINMENT_UNITS_PCT, 1);
    expect(kpis.openPipelineValue.value).toBe(OPEN_PIPELINE_VALUE_RUPEES);
    expect(kpis.conversionRate.value).toBeCloseTo(GROUP_CONVERSION_RATE_PCT, 1);
  });

  it("attainment carries the mandatory data-quality caveat (FR-003)", () => {
    const kpis = computeKpis(buildContext(fullFilters()));
    expect(kpis.attainment.caveat).toBeTruthy();
    expect(kpis.attainment.caveat).toMatch(/far above|targets/i);
  });

  it("suppresses every delta when there is no prior period (full range)", () => {
    const kpis = computeKpis(buildContext(fullFilters()));
    expect(kpis.deliveredUnits.delta).toBeNull();
    expect(kpis.deliveredRevenue.delta).toBeNull();
    expect(kpis.conversionRate.delta).toBeNull();
  });

  it("produces a real delta when a prior period exists", () => {
    const dataset = getDataset();
    const filters = parseFilters(
      new URLSearchParams({ preset: "month", month: "2025-12" }),
      buildParseFiltersContext(dataset),
    );
    const kpis = computeKpis(buildContext(filters));
    expect(kpis.deliveredUnits.delta).not.toBeNull();
    expect(kpis.deliveredUnits.delta?.basis).toBe("vs previous month");
  });

  it("conversion rate is null, not NaN, over a window with zero created leads", () => {
    const dataset = getDataset();
    const filters = parseFilters(
      new URLSearchParams({ preset: "custom", from: "2020-01-01", to: "2020-02-01" }),
      buildParseFiltersContext(dataset),
    );
    const kpis = computeKpis(buildContext(filters));
    expect(kpis.conversionRate.value).toBeNull();
    expect(Number.isNaN(kpis.conversionRate.value)).toBe(false);
  });

  it("attainment excludes branch-months with no target row rather than treating them as zero", () => {
    const dataset = getDataset();
    const filters = parseFilters(
      new URLSearchParams({ preset: "custom", from: "2020-01-01", to: "2020-02-01" }),
      buildParseFiltersContext(dataset),
    );
    const kpis = computeKpis(buildContext(filters));
    expect(kpis.attainment.value).toBeNull();
  });
});
