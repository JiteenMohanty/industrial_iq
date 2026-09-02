import { describe, it, expect } from "vitest";
import {
  rankBy,
  statusVsGroup,
  benchmark,
  rate,
  median,
  mean,
  BENCHMARK,
} from "@/lib/analytics/benchmark";

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
  it("refuses to rate below the minimum sample, and says so distinctly", () => {
    expect(statusVsGroup(10, 80, BENCHMARK.minSample - 1)).toBe("unrated");
  });

  it("refuses to rate when either figure is unmeasurable", () => {
    expect(statusVsGroup(null, 80, 100)).toBe("unrated");
    expect(statusVsGroup(50, null, 100)).toBe("unrated");
  });

  /**
   * The bug this suite exists to prevent recurring.
   *
   * "unrated" and "onPar" used to be a single `neutral` state rendered as one dash reading
   * "No reading". A rep 3 points ahead of the group and a rep on a 12-lead book we were declining
   * to judge looked identical — and so did a rep 43 points *behind* on that same thin book. The
   * two must stay distinguishable.
   */
  it("distinguishes 'in line with the group' from 'not rated'", () => {
    const inLine = statusVsGroup(82, 80, 100); // +2pp, measured, plenty of sample
    const tooFew = statusVsGroup(82, 80, BENCHMARK.minSample - 1); // same figures, thin book
    expect(inLine).toBe("onPar");
    expect(tooFew).toBe("unrated");
    expect(inLine).not.toBe(tooFew);
  });

  it("grades every measurable figure into exactly one band", () => {
    expect(statusVsGroup(90, 80, 100)).toBe("good"); // +10
    expect(statusVsGroup(85, 80, 100)).toBe("good"); // +5, boundary
    expect(statusVsGroup(84.9, 80, 100)).toBe("onPar"); // just inside
    expect(statusVsGroup(80, 80, 100)).toBe("onPar"); // level
    expect(statusVsGroup(75.1, 80, 100)).toBe("onPar"); // just inside on the low side
    expect(statusVsGroup(75, 80, 100)).toBe("warning"); // -5, boundary
    expect(statusVsGroup(70.1, 80, 100)).toBe("warning");
    expect(statusVsGroup(70, 80, 100)).toBe("critical"); // -10, boundary
    expect(statusVsGroup(40, 80, 100)).toBe("critical");
  });

  it("is symmetric around the group figure for the in-line band", () => {
    const above = statusVsGroup(80 + BENCHMARK.onParGapPoints - 0.1, 80, 100);
    const below = statusVsGroup(80 - BENCHMARK.onParGapPoints + 0.1, 80, 100);
    expect(above).toBe("onPar");
    expect(below).toBe("onPar");
  });

  it("inverts correctly when lower is better", () => {
    expect(statusVsGroup(60, 80, 100, { higherIsBetter: false })).toBe("good");
    expect(statusVsGroup(95, 80, 100, { higherIsBetter: false })).toBe("critical");
    expect(statusVsGroup(81, 80, 100, { higherIsBetter: false })).toBe("onPar");
  });
});

describe("benchmark", () => {
  it("carries the gap alongside the status", () => {
    const b = benchmark(83.3, 80, 100, { label: "Contact rate" });
    expect(b.status).toBe("onPar");
    expect(b.gapPoints).toBeCloseTo(3.3, 5);
  });

  it("spells the comparison out, so the glyph never has to be guessed at", () => {
    const b = benchmark(90, 76.7, 33, { label: "Contact rate" });
    expect(b.title).toContain("Contact rate");
    expect(b.title).toContain("above");
    expect(b.title).toContain("76.7%");
    expect(b.title).toContain("33 leads");
  });

  it("explains a refusal to rate rather than leaving a bare dash", () => {
    const b = benchmark(33.3, 76.7, 12, { label: "Contact rate" });
    expect(b.status).toBe("unrated");
    expect(b.gapPoints).toBeNull();
    expect(b.title).toContain("Not rated");
    expect(b.title).toContain("12 leads");
    expect(b.title).toContain(String(BENCHMARK.minSample));
  });

  it("reads 'level with' at exactly the group figure", () => {
    expect(benchmark(80, 80, 100).title).toContain("level with");
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
