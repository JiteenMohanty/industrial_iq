import { describe, it, expect } from "vitest";
import { parseFilters, buildHref, type ParseFiltersContext } from "@/lib/filters/parse";
import type { Filters } from "@/lib/filters/types";

const ctx: ParseFiltersContext = {
  dataAsOf: new Date("2025-12-31T19:10:00Z"),
  minDate: new Date("2025-06-01T18:46:00Z"),
  validBranchIds: new Set(["B1", "B2", "B3", "B4", "B5"]),
  validMonths: new Set([
    "2025-06",
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
  ]),
};

function qs(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

describe("parseFilters — total function, never throws", () => {
  it("defaults to full range with no params", () => {
    const f = parseFilters(qs({}), ctx);
    expect(f.preset).toBe("full");
    expect(f.from).toEqual(ctx.minDate);
    expect(f.to).toEqual(ctx.dataAsOf);
    expect(f.branchId).toBeNull();
  });

  it("degrades an unrecognised preset to full", () => {
    const f = parseFilters(qs({ preset: "nonsense" }), ctx);
    expect(f.preset).toBe("full");
  });

  it("resolves last30 anchored to DATA_AS_OF, not the system clock", () => {
    const f = parseFilters(qs({ preset: "last30" }), ctx);
    expect(f.to).toEqual(ctx.dataAsOf);
    expect(f.from.toISOString().slice(0, 10)).toBe("2025-12-01");
  });

  it("resolves last90 anchored to DATA_AS_OF", () => {
    const f = parseFilters(qs({ preset: "last90" }), ctx);
    expect(f.from.toISOString().slice(0, 10)).toBe("2025-10-02");
  });

  it("degrades preset=month with an out-of-coverage month to full", () => {
    const f = parseFilters(qs({ preset: "month", month: "2024-01" }), ctx);
    expect(f.preset).toBe("full");
  });

  it("resolves a valid month to its calendar bounds", () => {
    const f = parseFilters(qs({ preset: "month", month: "2025-09" }), ctx);
    expect(f.preset).toBe("month");
    expect(f.from.toISOString().slice(0, 10)).toBe("2025-09-01");
    expect(f.to.toISOString().slice(0, 10)).toBe("2025-09-30");
  });

  it("December's upper bound lands on the 31st, same calendar day as DATA_AS_OF", () => {
    const f = parseFilters(qs({ preset: "month", month: "2025-12" }), ctx);
    expect(f.to.toISOString().slice(0, 10)).toBe("2025-12-31");
    expect(f.to.getTime()).toBeLessThanOrEqual(ctx.dataAsOf.getTime());
  });

  it("degrades preset=custom with missing dates to full", () => {
    const f = parseFilters(qs({ preset: "custom" }), ctx);
    expect(f.preset).toBe("full");
  });

  it("degrades preset=custom with unparseable dates to full", () => {
    const f = parseFilters(qs({ preset: "custom", from: "not-a-date", to: "2025-07-01" }), ctx);
    expect(f.preset).toBe("full");
  });

  it("swaps an inverted custom range rather than rejecting it", () => {
    const f = parseFilters(
      qs({ preset: "custom", from: "2025-09-01", to: "2025-07-01" }),
      ctx,
    );
    expect(f.preset).toBe("custom");
    expect(f.from.toISOString().slice(0, 10)).toBe("2025-07-01");
    expect(f.to.toISOString().slice(0, 10)).toBe("2025-09-01");
  });

  it("accepts a custom range wholly outside coverage without erroring", () => {
    const f = parseFilters(
      qs({ preset: "custom", from: "2020-01-01", to: "2020-02-01" }),
      ctx,
    );
    expect(f.preset).toBe("custom");
    expect(f.from.toISOString().slice(0, 10)).toBe("2020-01-01");
  });

  it("ignores an unknown branch id", () => {
    const f = parseFilters(qs({ branch: "B9" }), ctx);
    expect(f.branchId).toBeNull();
  });

  it("ignores a malicious branch id without throwing", () => {
    const f = parseFilters(qs({ branch: "<script>alert(1)</script>" }), ctx);
    expect(f.branchId).toBeNull();
  });

  it("accepts a known branch id", () => {
    const f = parseFilters(qs({ branch: "B3" }), ctx);
    expect(f.branchId).toBe("B3");
  });
});

describe("buildHref / parseFilters round-trip", () => {
  const cases: Array<[string, () => Filters]> = [
    ["full, no branch", () => parseFilters(qs({}), ctx)],
    ["last30 with branch", () => parseFilters(qs({ preset: "last30", branch: "B3" }), ctx)],
    ["last90", () => parseFilters(qs({ preset: "last90" }), ctx)],
    ["month", () => parseFilters(qs({ preset: "month", month: "2025-09" }), ctx)],
    [
      "custom",
      () => parseFilters(qs({ preset: "custom", from: "2025-07-01", to: "2025-08-15" }), ctx),
    ],
  ];

  for (const [label, make] of cases) {
    it(`round-trips: ${label}`, () => {
      const original = make();
      const href = buildHref("/", original);
      const reparsed = parseFilters(new URLSearchParams(href.split("?")[1] ?? ""), ctx);
      expect(reparsed).toEqual(original);
    });
  }

  it("full range produces a bare path with no query string", () => {
    const f = parseFilters(qs({}), ctx);
    expect(buildHref("/funnel", f)).toBe("/funnel");
  });

  it("overrides merge onto the base filters", () => {
    const f = parseFilters(qs({ preset: "last30" }), ctx);
    const href = buildHref("/branches/B3", f, { branchId: "B3" });
    expect(href).toContain("branch=B3");
    expect(href).toContain("preset=last30");
  });
});
