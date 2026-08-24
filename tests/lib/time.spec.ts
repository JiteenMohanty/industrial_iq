import { describe, it, expect } from "vitest";
import { computeDataAsOf, daysBetween, monthsBetween, toMonthKey, addDays } from "@/lib/time";
import type { RawLead } from "@/lib/data/types";

function fakeLead(overrides: Partial<RawLead> & { created_at: string; last_activity_at: string; status_history: RawLead["status_history"] }): RawLead {
  return {
    id: "L0",
    customer_name: "Test",
    phone: "0000000000",
    source: "walk_in",
    model_interested: "Model",
    status: "new",
    assigned_to: "SR1",
    branch_id: "B1",
    expected_close_date: "2025-07-01",
    deal_value: 1000000,
    lost_reason: null,
    ...overrides,
  };
}

describe("computeDataAsOf", () => {
  it("returns the max timestamp across created_at, last_activity_at, and status_history", () => {
    const leads: RawLead[] = [
      fakeLead({
        created_at: "2025-06-01T00:00:00Z",
        last_activity_at: "2025-06-05T00:00:00Z",
        status_history: [{ status: "new", timestamp: "2025-06-01T00:00:00Z", note: "" }],
      }),
      fakeLead({
        created_at: "2025-12-31T19:10:00Z",
        last_activity_at: "2025-12-30T00:00:00Z",
        status_history: [
          { status: "new", timestamp: "2025-12-31T19:10:00Z", note: "" },
        ],
      }),
    ];
    expect(computeDataAsOf(leads).toISOString()).toBe("2025-12-31T19:10:00.000Z");
  });

  it("throws when given no leads", () => {
    expect(() => computeDataAsOf([])).toThrow();
  });
});

describe("daysBetween", () => {
  it("floors both operands to UTC calendar date before differencing", () => {
    const morning = new Date("2025-12-31T00:05:00Z");
    const evening = new Date("2025-12-31T23:55:00Z");
    expect(daysBetween(morning, evening)).toBe(0);
  });

  it("is stable across a threshold boundary regardless of time-of-day", () => {
    const orderedLateInDay = new Date("2025-12-01T23:00:00Z");
    const asOfEarlyInDay = new Date("2025-12-28T00:10:00Z");
    // Naive ms-diff would read ~26.05 days; calendar-date diff must read exactly 27.
    expect(daysBetween(orderedLateInDay, asOfEarlyInDay)).toBe(27);
  });

  it("computes the verified 194-day oldest stuck order age", () => {
    const orderPlaced = new Date("2025-06-20T00:00:00Z");
    const dataAsOf = new Date("2025-12-31T19:10:00Z");
    expect(daysBetween(orderPlaced, dataAsOf)).toBe(194);
  });
});

describe("monthsBetween", () => {
  it("counts whole calendar months", () => {
    expect(monthsBetween(new Date("2025-06-01Z"), new Date("2025-12-01Z"))).toBe(6);
  });
});

describe("toMonthKey", () => {
  it("formats as YYYY-MM", () => {
    expect(toMonthKey(new Date("2025-07-17T00:00:00Z"))).toBe("2025-07");
  });
});

describe("addDays", () => {
  it("adds/subtracts calendar days", () => {
    expect(addDays(new Date("2025-12-31T19:10:00Z"), -30).toISOString().slice(0, 10)).toBe(
      "2025-12-01",
    );
  });
});
