import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/dataset";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { applyFilters } from "@/lib/filters/apply";

describe("applyFilters — calendar-date boundary inclusion", () => {
  it("includes leads created later on the last day of a month window, not just its midnight instant", () => {
    const dataset = getDataset();
    const ctx = buildParseFiltersContext(dataset);
    const filters = parseFilters(new URLSearchParams({ preset: "month", month: "2025-12" }), ctx);

    // DATA_AS_OF (2025-12-31T19:10:00Z) is itself a Dec-31 lead timestamp. If the window
    // comparison used raw instants against a midnight `to` bound, this lead would be silently
    // excluded from "December" — exactly the bug this test guards against.
    const { leads } = applyFilters(dataset.leads, dataset.deliveries, filters);
    const latestLead = dataset.leads.find((l) => l.createdAt.getTime() === dataset.dataAsOf.getTime());
    expect(latestLead).toBeDefined();
    expect(leads).toContain(latestLead);
  });

  it("a custom range's end date includes every lead created that day, any time", () => {
    const dataset = getDataset();
    const ctx = buildParseFiltersContext(dataset);
    // Full range end == DATA_AS_OF's exact instant; a custom range naming the same calendar day
    // as its `to` must include leads timestamped later that day.
    const filters = parseFilters(
      new URLSearchParams({ preset: "custom", from: "2025-12-31", to: "2025-12-31" }),
      ctx,
    );
    const { leads } = applyFilters(dataset.leads, dataset.deliveries, filters);
    expect(leads.every((l) => l.createdAt.toISOString().slice(0, 10) === "2025-12-31")).toBe(true);
    expect(leads.length).toBeGreaterThan(0);
  });
});
