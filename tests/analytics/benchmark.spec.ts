import { describe, it, expect } from "vitest";
import { rankBy, statusVsGroup, rate, median, mean, BENCHMARK } from "@/lib/analytics/benchmark";

describe("rate / median / mean", () => {
  it("returns null on a zero denominator rather than NaN or Infinity (SC-006)", () => {
    expect(rate(5, 0)).toBeNull();
    expect(median([])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("computes an even-length median as the midpoint of the two central values", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("statusVsGroup", () => {
  it("withholds a judgement below the minimum sample rather than guessing", () => {
    expect(statusVsGroup(10, 80, BENCHMARK.minSample - 1)).toBe("neutral");
  });

  it("withholds a judgement when either figure is unmeasurable", () => {
    expect(statusVsGroup(null, 80, 100)).toBe("neutral");
    expect(statusVsGroup(50, null, 100)).toBe("neutral");
  });

  it("grades against the group figure in both directions", () => {
    expect(statusVsGroup(90, 80, 100)).toBe("good");
    expect(statusVsGroup(60, 80, 100)).toBe("critical");
    expect(statusVsGroup(77, 80, 100)).toBe("warning");
    expect(statusVsGroup(82, 80, 100)).toBe("neutral");
  });

  it("inverts correctly when lower is better", () => {
    expect(statusVsGroup(60, 80, 100, { higherIsBetter: false })).toBe("good");
    expect(statusVsGroup(95, 80, 100, { higherIsBetter: false })).toBe("critical");
  });
});

describe("rankBy", () => {
  const rows = [
    { id: "a", v: 10 },
    { id: "b", v: 30 },
    { id: "c", v: 20 },
    { id: "d", v: null as number | null },
  ];

  it("ranks descending by default and sorts nulls last", () => {
    const ranked = rankBy(rows, (r) => r.v, (r) => r.id);
    expect(ranked.map((r) => r.row.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("ranks ascending when asked, still with nulls last", () => {
    const ranked = rankBy(rows, (r) => r.v, (r) => r.id, "asc");
    expect(ranked.map((r) => r.row.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("gives tied rows the same rank and stays deterministic across runs", () => {
    const tied = [
      { id: "y", v: 5 },
      { id: "x", v: 5 },
      { id: "z", v: 9 },
    ];
    const a = rankBy(tied, (r) => r.v, (r) => r.id);
    const b = rankBy(tied, (r) => r.v, (r) => r.id);
    expect(a.map((r) => r.row.id)).toEqual(b.map((r) => r.row.id));
    expect(a.find((r) => r.row.id === "x")?.rank).toBe(a.find((r) => r.row.id === "y")?.rank);
  });

  it("handles a single row without dividing by zero", () => {
    const ranked = rankBy([{ id: "solo", v: 1 }], (r) => r.v, (r) => r.id);
    expect(ranked[0]?.percentile).toBe(1);
  });
});
