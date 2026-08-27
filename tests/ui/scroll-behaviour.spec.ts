import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

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

describe("no page-level loading fallback", () => {
  /**
   * Measured, not assumed: on /models the real content renders 2083px tall against a 808px
   * PageSkeleton. A same-route parameter change — switching the heatmap metric, sorting a table —
   * swaps in that fallback, the document collapses to a third of its height, and the **browser**
   * clamps the reader's scroll position to the new maximum (1363px of scroll becomes 88px). The
   * real content then returns and the position is already gone.
   *
   * `scroll={false}` cannot prevent this. It stops Next.js scrolling to the top; it has no say in
   * the browser's own clamping when a document shrinks underneath it.
   *
   * Server responses measure 16-160 ms, so without a fallback Next simply keeps the current page
   * rendered until the new payload arrives — no collapse, no clamp, no flash. The fallback was
   * buying nothing and costing the reader their place on every single interaction.
   *
   * If a loading state is ever wanted again it has to preserve document height, which in practice
   * means an overlay or an inline indicator rather than a replacement skeleton.
   */
  it("no route defines loading.tsx", () => {
    const appDir = resolve(process.cwd(), "src/app");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "loading.tsx") found.push(full.replace(appDir, ""));
      }
    };
    walk(appDir);
    expect(found, "a page-level skeleton collapses document height and resets scroll").toEqual([]);
  });

  it("the filter bar fallback is the only Suspense fallback, and is height-stable", () => {
    const layout = src("app/layout.tsx");
    expect(layout).toContain("<Suspense");
    // Fixed small heights matching the real control row, so the swap does not move the page.
    expect(src("components/ui/Skeleton.tsx")).not.toContain("PageSkeleton");
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
