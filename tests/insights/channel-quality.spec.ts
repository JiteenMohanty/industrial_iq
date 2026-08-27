import { describe, it, expect } from "vitest";
import { run, slug } from "@/lib/insights/rules/channel-quality";
import { fullContext } from "./_helpers";

describe("insight rule: channel-quality", () => {
  it("fires for social_media alone (13.9% conversion at 14.1% volume share)", () => {
    const insights = run(fullContext());
    expect(insights).toHaveLength(1);
    expect(insights[0]?.entity.id).toBe("social_media");
    expect(insights[0]?.metric.value).toBeCloseTo(13.9, 1);
    expect(insights[0]?.severity).toBe("info");
  });

  it("does not fire for any other channel — all clear the 20% floor", () => {
    const insights = run(fullContext());
    const otherChannels = ["walk_in", "website", "phone_enquiry", "referral", "auto_expo"];
    for (const channel of otherChannels) {
      expect(insights.some((i) => i.entity.id === channel)).toBe(false);
    }
  });

  it("drills through to the lead-source view, with its evidence link scoped to that source", () => {
    const insights = run(fullContext());
    expect(insights[0]?.id).toBe(`${slug}:social_media`);
    // v2: the entity link goes to the source analysis, and a separate evidence link goes to the
    // specific leads. Previously this pointed at /funnel, which showed neither.
    expect(insights[0]?.href).toBe("/sources");
    expect(insights[0]?.evidenceHref).toContain("/leads");
    expect(insights[0]?.evidenceHref).toContain("source=social_media");
  });
});
