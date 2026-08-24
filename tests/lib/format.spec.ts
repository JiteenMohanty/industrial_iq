import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCount,
  formatPercent,
  formatDays,
  formatDate,
  formatDelta,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("renders the verified crore figures exactly", () => {
    expect(formatCurrency(85_860_000)).toBe("₹8.59 Cr");
    expect(formatCurrency(388_760_000)).toBe("₹38.88 Cr");
  });

  it("renders lakhs below one crore", () => {
    expect(formatCurrency(2_040_000)).toBe("₹20.40 L");
    expect(formatCurrency(750_000)).toBe("₹7.50 L");
  });

  it("renders plain rupees with Indian grouping below one lakh", () => {
    expect(formatCurrency(99_999)).toBe("₹99,999");
    expect(formatCurrency(0)).toBe("₹0");
  });

  it("never emits a raw unformatted digit dump for a large figure", () => {
    const result = formatCurrency(85_900_000);
    expect(result).not.toContain("85900000");
    expect(result).not.toMatch(/₹85,900,000/); // Western grouping is explicitly the bad example
  });

  it("handles negative values with a leading sign", () => {
    expect(formatCurrency(-85_860_000)).toBe("-₹8.59 Cr");
  });
});

describe("formatCount", () => {
  it("groups with Indian digit placement", () => {
    expect(formatCount(1426)).toBe("1,426");
    expect(formatCount(510)).toBe("510");
  });
});

describe("formatPercent", () => {
  it("expects the 0-100 convention, not 0-1", () => {
    expect(formatPercent(58.2)).toBe("58.2%");
    expect(formatPercent(11.2)).toBe("11.2%");
  });
});

describe("formatDays", () => {
  it("pluralises correctly", () => {
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(27)).toBe("27 days");
    expect(formatDays(0)).toBe("0 days");
  });
});

describe("formatDate", () => {
  it("renders DATA_AS_OF as a readable date", () => {
    expect(formatDate(new Date("2025-12-31T19:10:00Z"))).toBe("31 Dec 2025");
  });
});

describe("formatDelta", () => {
  it("returns an explicit no-comparison message when there is no prior period", () => {
    expect(formatDelta(null, "rupees")).toBe("No prior period to compare");
  });

  it("formats an absolute rupee delta, not a relative percentage", () => {
    const result = formatDelta(
      { change: 5_000_000, direction: "up", basis: "vs previous 90 days" },
      "rupees",
    );
    expect(result).toBe("▲ +₹50.00 L vs previous 90 days");
  });

  it("formats a percentage-point delta with 'pp', not '%'", () => {
    const result = formatDelta(
      { change: 5, direction: "up", basis: "vs previous 90 days" },
      "pct",
    );
    expect(result).toBe("▲ +5.0pp vs previous 90 days");
  });

  it("formats a down delta with a minus sign", () => {
    const result = formatDelta(
      { change: 12, direction: "down", basis: "vs previous month" },
      "count",
    );
    expect(result).toBe("▼ -12 vs previous month");
  });

  it("formats a flat delta with no sign", () => {
    const result = formatDelta(
      { change: 0, direction: "flat", basis: "vs previous month" },
      "count",
    );
    expect(result).toBe("— 0 vs previous month");
  });
});
