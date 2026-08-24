import { describe, it, expect } from "vitest";
import { computeChannelPerformance } from "@/lib/analytics/channels";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { CHANNEL_CONVERSION } from "../fixtures";

function fullContext() {
  const dataset = getDataset();
  return buildContext(parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset)));
}

describe("computeChannelPerformance", () => {
  it("reproduces every verified channel conversion rate", () => {
    const channels = computeChannelPerformance(fullContext());
    for (const [source, expected] of Object.entries(CHANNEL_CONVERSION)) {
      const channel = channels.find((c) => c.channel === source);
      expect(channel?.conversionPct).toBeCloseTo(expected.pct, 1);
      expect(channel?.totalLeads).toBe(expected.total);
    }
  });

  it("covers all 6 channels summing to the total lead count", () => {
    const channels = computeChannelPerformance(fullContext());
    expect(channels).toHaveLength(6);
    const total = channels.reduce((sum, c) => sum + c.totalLeads, 0);
    expect(total).toBe(510);
  });
});
