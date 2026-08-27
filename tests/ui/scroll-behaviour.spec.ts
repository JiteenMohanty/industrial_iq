import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guards the in-place-navigation convention.
 *
 * The URL is the only view state in this product, so switching a chart's measure, sorting a table
 * or opening a lead sheet are all URL changes — indistinguishable, to Next.js, from navigating to
 * another page. Its default is to scroll to the top of the document, which for a control halfway
 * down a page reads as the whole thing reloading and throws the reader away from what they were
 * looking at. The data changes correctly and the UI feels broken.
 *
 * `ViewLink` exists to draw that distinction. These are source-level assertions rather than
 * rendered-DOM ones because the analytics suite runs in a Node environment with no DOM — but the
 * failure mode here is a developer reaching for the wrong component, which source inspection
 * catches perfectly well.
 */
const src = (p: string) => readFileSync(resolve(process.cwd(), "src", p), "utf8");

describe("ViewLink", () => {
  it("always suppresses the scroll-to-top", () => {
    const file = src("components/ui/ViewLink.tsx");
    expect(file).toContain("scroll={false}");
  });

  it("is the only place scroll={false} needs to be written for links", () => {
    // If this count ever exceeds one, the convention has leaked and a call site is hand-rolling it.
    const files = [
      "components/ui/SegmentedControl.tsx",
      "components/ui/DataTable.tsx",
      "components/insights/InsightFeed.tsx",
    ];
    for (const f of files) {
      expect(src(f), `${f} should delegate to ViewLink, not set scroll itself`).not.toContain(
        "scroll={false}",
      );
    }
  });
});

describe("controls that change the current view use ViewLink", () => {
  /** Every option in a segmented control re-renders the page it sits on. */
  it("SegmentedControl", () => {
    const file = src("components/ui/SegmentedControl.tsx");
    expect(file).toContain("ViewLink");
    expect(file).not.toMatch(/<Link\b/);
  });

  /** Sorting a table must not move the reader away from the table. */
  it("DataTable sort headers", () => {
    const file = src("components/ui/DataTable.tsx");
    expect(file).toContain("ViewLink");
    // Row links stay ordinary <Link> unless the row opens something on the same page.
    expect(file).toContain("rowPreservesScroll");
  });

  /** The "show all problems" disclosure expands the feed in place. */
  it("InsightFeed disclosure", () => {
    const file = src("components/insights/InsightFeed.tsx");
    expect(file).toContain("ViewLink");
    expect(file).not.toMatch(/<Link\b/);
  });
});

describe("imperative navigations preserve scroll where they change the current view", () => {
  it.each([
    ["components/filters/TimeRangeFilter.tsx", "time range control"],
    ["components/filters/BranchFilter.tsx", "branch control"],
    ["components/leads/LeadDetailSheet.tsx", "closing the lead sheet"],
  ])("%s", (path) => {
    const file = src(path);
    const pushes = file.match(/router\.push\([^)]*\)/g) ?? [];
    expect(pushes.length).toBeGreaterThan(0);
    for (const call of pushes) {
      expect(call, `${path}: router.push must pass { scroll: false }`).toContain("scroll: false");
    }
  });
});

describe("pages whose table rows open a sheet in place opt in", () => {
  it.each([
    ["app/leads/page.tsx", "lead explorer"],
    ["app/deliveries/page.tsx", "stuck-order watchlist"],
    ["app/reps/[repId]/page.tsx", "assigned leads"],
  ])("%s", (path) => {
    expect(src(path)).toContain("rowPreservesScroll");
  });
});

describe("no raw anchors for internal navigation", () => {
  /**
   * A bare `<a href="/...">` triggers a full document reload, which is both slow and loses view
   * state. The only legitimate raw anchors are the skip link (a fragment) and the CSV download
   * (a real file response the router must not intercept).
   */
  it.each([
    "app/leads/page.tsx",
    "app/models/page.tsx",
    "app/sources/page.tsx",
    "app/branches/page.tsx",
    "app/reps/page.tsx",
    "app/funnel/page.tsx",
    "app/page.tsx",
  ])("%s", (path) => {
    const file = src(path);
    const anchors = file.match(/<a\s+href=\{?["']?\/[^}"'\s]*/g) ?? [];
    expect(anchors, `${path} should use Link/ViewLink, not <a>, for internal routes`).toEqual([]);
  });

  it("allows the two deliberate exceptions", () => {
    // Skip link: a same-document fragment, correctly a plain anchor.
    expect(src("app/layout.tsx")).toContain('href="#main-content"');
    // CSV: an API route returning a file — client-side routing must not intercept it.
    expect(src("components/insights/InsightCard.tsx")).toMatch(/<a href=\{callListHref/);
  });
});
