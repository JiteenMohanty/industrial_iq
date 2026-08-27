# Tasks: Gate-First Dealership Intelligence (v2)

**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md)

Status reflects the shipped state. `[X]` = done and verified; `[ ]` = not done, with the reason.

## Phase 1 — Discovery

- [X] T200 Re-read the assignment brief end to end; extract explicit requirements, the open-ended
  space, and the evaluation weights.
- [X] T201 Three-pass exploratory data analysis over `dealership_data.json`: data quality and
  integrity; business segments and concentration; hypothesis elimination.
- [X] T202 Establish the central structural finding — funnel strictly sequential (0 stage skips
  across 510 leads), test drive absolute (0 of 91 contacted-but-not-test-driven ever delivered).
- [X] T203 Eliminate the two obvious explanations for the worst branch: lead quality (source mix is
  unremarkable; a healthier branch takes 2× the social-media share) and capacity (it carries the
  lightest load in the group).
- [X] T204 Study the reference dealership KPI dashboard. Adopted: role-oriented views, a hard cap
  on headline metrics, traffic-light status, trend indicators. Rejected: its five separate
  role-specific dashboards — with one dataset and no auth, section-per-question beats
  dashboard-per-role.
- [X] T205 Audit v1 across UX, information architecture, engineering, and verification claims;
  record nine findings, each mapped to a v2 requirement.
- [X] T206 Review the existing Spec Kit artifacts; decide to supersede rather than edit `001`.

## Phase 2 — Data and analytics

- [X] T210 Extend `EnrichedLead` with `wasContacted`, `tookTestDrive`, `cycleDays`,
  `expectedCloseAt`, `closeSlipDays`; extend `Dataset` with `models`, `sources`, `leadsByModel`,
  `leadsBySource`. All derived once at parse time.
- [X] T211 `analytics/gates.ts` — `computeGatesFor` over an explicit pool, `computeGates` for the
  group, `computeBranchGates` for the comparison.
- [X] T212 `analytics/benchmark.ts` — `rankBy`, `statusVsGroup`, null-safe `rate`/`mean`/`median`.
  Status is always relative to the group's own figure; entities under 15 leads get none.
- [X] T213 `analytics/models.ts` — model economics, `computeInterestMatrix`, `computeModelTrend`,
  `computeAspTrend`, `heatmapHighlights`.
- [X] T214 `analytics/sources.ts` — replaces `channels.ts`; adds gate rates, conversion among
  contacted, revenue per lead. Old module deleted, tests renamed.
- [X] T215 Extend `analytics/reps.ts` with contact rate, test-drive rate, revenue, revenue per lead.
- [X] T216 Extend `analytics/deliveries.ts` with promise reliability and slip distribution.
- [X] T217 Extend `analytics/trends.ts` with `computeRevenueTrend` and `computeGateTrend`, the
  latter marking which monthly cohorts are mature enough to read.
- [X] T218 Extend `analytics/leads.ts` with `queryLeads` — cohorts matching the detection rules,
  entity filters, total-ordered sorting.
- [X] T219 Add `stepConversionPct` to the funnel result and `medianDays` to stage durations.
- [X] T220 `filters/page-context.ts` — `resolvePage()`; extend `buildHref` with non-filter params
  so no call site concatenates query strings by hand.

## Phase 3 — Insights

- [X] T230 Add `evidenceHref` and `action` to the `Insight` contract; both required, never optional.
- [X] T231 Update all nine existing rules with an evidence link and an action line.
- [X] T232 New rule: test-drive gate (70% floor, 15 contacted minimum). Fires for one branch on
  this extract — the honest outcome, not tuned for a fuller feed.
- [X] T233 New rule: promise reliability (60% late floor, 15 delivered minimum). Carries a null
  monetary impact deliberately.
- [X] T234 `selectHeadlines()` — round-robin across rules for the landing feed, leaving
  `runInsights()`'s strict total order intact for the CSV endpoint and determinism.
- [X] T235 Repoint the channel-quality rule from `/funnel` to `/sources`.

## Phase 4 — Design system

- [X] T240 Rebuild tokens: three surfaces, four ink weights, mode-invariant status with text-safe
  variants, eight categorical series, eight-step sequential ramp with paired inks.
- [X] T241 Rebuild primitives — `Card`, `SectionHeading`, `StatTile`, `Badge`/`StatusDot`/
  `RankBadge`/`Pill`/`TrendIndicator`, `DataTable` with URL-driven sorting, `MetricBar`,
  `EmptyState`, `Skeleton`, `Callout`, `SegmentedControl`.
- [X] T242 Charts: `GateFunnel`, `FunnelChart`, `InterestHeatmap`, `RankedBar`/`DistributionBars`,
  `Sparkline` — all server-rendered. `TrendChart` and `RepScatter` stay client-side where
  interactivity earns it. `ComparisonBar` and `StageMix` deleted as superseded.
- [X] T243 Re-validate the categorical palette against this product's surfaces with the dataviz
  validator (three-slot all-pairs, both modes).

## Phase 5 — Routes

- [X] T250 `/` — six KPIs, gate funnel, three storytelling callouts, Action Center, trend with
  metric switch, branch scorecard.
- [X] T251 `/funnel` — gates, stage funnel with branch overlay and an automatic reading of the
  divergence, per-branch gate table, stage durations, loss analysis with its reliability caveat.
- [X] T252 `/models` — the customer-interest heatmap with dimension and metric controls, model
  economics, stranded value by model.
- [X] T253 `/sources` — channel scorecard with the neglect-versus-quality split, revenue per lead,
  test-drive rate, and the no-cost-data caveat.
- [X] T254 `/branches` and `/branches/[branchId]`.
- [X] T255 `/reps` and `/reps/[repId]`, including the volume-versus-efficiency quadrant.
- [X] T256 `/deliveries` — stuck orders with staleness, delay reasons with the
  outside-our-control note, promise reliability, and the explicit statement on inventory-based ADS.
- [X] T257 `/leads` — the evidence explorer.
- [X] T258 Navigation, loading skeletons, and not-found states for every route.

## Phase 6 — Validation

- [X] T260 `npm run build` clean; 12 routes; TypeScript clean.
- [X] T261 Test suite: 287 passing across 35 files (226 at the end of Phase 6; the rest added by Phase 8), including new suites for gates, models,
  promise reliability, benchmark, lead queries, headline selection, and both new rules.
- [X] T262 Route smoke test over 32 URL variants — including malformed params, unknown ids and a
  zero-result range — parsing rendered output for `NaN` / `Infinity` / `undefined` and for expected
  content. 30/32 fully clean; the 2 exceptions are the documented not-found status-code limitation.
- [X] T263 Measure horizontal overflow on every route at 1440 / 1024 / 768. **Found a real bug**:
  199px overflow on `/models` at 768px, caused by CSS Grid's `min-width: auto` letting a wide table
  size its track. Fixed on the `Card` primitive; re-measured at 0px everywhere.
- [X] T264 Accessibility audit of rendered pages. **Found three real contrast failures**: an active
  segmented-control tab (3.64:1), a heatmap ramp step carrying white text (3.64:1), and a "no data"
  placeholder (3.26:1). Also found a decorative icon exposed to assistive tech, and a theme-state
  bug putting both ramps on screen at once. All fixed.
- [X] T265 Convert contrast from a one-off check into `tests/design/contrast.spec.ts` — 14
  assertions over every token pair in both modes, parsed from `globals.css`.
- [X] T266 Verify the dataset is absent from every client chunk (`.next/static` grep).
- [X] T267 Verify the CSV endpoint: correct row count, UTF-8 BOM, filename, 400 and 404 paths.

## Phase 7 — Documentation

- [X] T270 Amend the constitution to 2.0.0 — Principle IV redefined, Principle V expanded,
  Principle VIII added, gates 6 and 7 rewritten to demand measurement.
- [X] T271 Write this spec set (`spec.md`, `plan.md`, `tasks.md`), superseding `001`.
- [X] T272 Rewrite `DECISIONS.md` for the second submission.
- [X] T273 Update `README.md`.

## Phase 8 — Filter scope correction (post-review)

Raised by the user after the rebuild: the global filter bar was displayed on every page but only
changed anything on three of them. Investigation confirmed it, and found it was worse than reported
— the time range reached only the Overview's KPI tiles.

- [X] T290 Audit every analytics function's data scope. Found nearly all of them reading the
  unfiltered `groupLeads` pool, making the shared controls inert on `/funnel`, `/models`,
  `/sources`, `/reps` and most of `/deliveries`.
- [X] T291 Add `windowLeads`/`windowDeliveries` (time-scoped, all branches) to `AnalyticsContext` —
  the correct baseline for a comparison made inside a selected window.
- [X] T292 Rewire population views (funnel, stage durations, loss breakdown, models, sources, reps,
  delivery ops, promise reliability, revenue trend) onto the reader's selection.
- [X] T293 Keep present-tense state on branch-only scope (alerts, gates, stuck orders, lead
  explorer) and give `computeChannelPerformance` its own detection-scoped pass, so the
  channel-quality rule stays FR-009-compliant rather than inheriting the page's time window.
- [X] T294 Move cross-branch comparison tables onto `windowLeads` so they follow the time filter
  while still ranking every branch.
- [X] T295 Repoint funnel baselines at `pool: "window"` on `/funnel`, `/branches/[id]` and
  `/reps/[id]` — otherwise a reader with the branch filter set would see a branch compared against
  itself.
- [X] T296 Make the filter bar route-aware: hide the branch control on the two single-entity detail
  pages and on the branch comparison, and state the scope inline where a filter is deliberately
  ignored.
- [X] T297 `tests/filters/scope-coverage.spec.ts` — 61 assertions covering 20 functions in both
  directions, plus coherence checks (shares sum to the selection, a branch overlay is measured
  against all branches, zero-result windows do not throw).
- [X] T298 Verify per route that the rendered output actually changes: branch and time both move
  every page except the two deliberate exceptions. Smoke test extended to 41 URL variants.

## Phase 9 — Demand seasonality and rep head-to-head (post-review)

Requested after the filter fix: a top-selling-model tile, a real comparison in place of the rep
callouts, and a seasonality reading if the data supported one.

- [X] T300 `computeSeasonality` — enquiries by creation month against units by delivery month, each
  with its distance from the monthly mean, plus the lag between the two peaks. Branch-scoped, not
  time-scoped (FR-113a).
- [X] T301 Verify the seasonality claim before writing any copy. Enquiries peak Nov (95, +30% vs
  mean); deliveries peak Dec (52, +127%). The one-month lag matches the 38-day median cycle, so the
  festive-quarter surge is an Oct–Nov event delivered in December.
- [X] T302 Check the Diwali hypothesis at weekly granularity before asserting it. Diwali 2025 fell
  on 20 Oct, inside the enquiry peak, but weekly volume is broadly elevated across Oct–Nov rather
  than spiking in any single week. Copy states a festive-*quarter* reading, labels the festival date
  as context external to the dataset, and does not claim a single-festival cause.
- [X] T303 Add the "Top seller by units" tile immediately after "Models in range" — a different
  model from both the revenue leader and the interest leader, which is the mix finding in one tile.
- [X] T304 `computeRepHeadToHead` — best vs worst by revenue per lead above the sample floor, with
  a per-metric gap and the widest gate identified.
- [X] T305 Replace the three disconnected rep callouts with the head-to-head comparison. They each
  named a different rep for a different reason and never answered "what separates my best from my
  worst".
- [X] T306 Empty state for the head-to-head: inside a single month no officer clears the 15-lead
  floor, so the section explains the floor rather than vanishing (FR-121a).
- [X] T307 Fix `formatCurrency` below ₹1 lakh — the branch was unreachable while the smallest figure
  in the product was a deal value, and rendered "₹45,909.091" once revenue per lead made it live.
  Regression test added.
- [X] T308 Tests: 16 for seasonality and head-to-head, 3 for the currency regression, both new
  functions added to the filter-scope contract. 311 passing across 36 files.

## Phase 10 — In-place controls no longer scroll to the top (post-review)

- [X] T310 Introduce `ViewLink` and route every in-place control through it: segmented controls,
  table sort headers, the alert-feed disclosure, and table rows that open the lead sheet. Plain
  `Link` is retained wherever the click genuinely navigates.
- [X] T311 `router.push(href, { scroll: false })` for the two filter selects and for closing the
  lead detail sheet.
- [X] T312 Replace `/leads`' raw `<a>` "Clear entity filters" — it was forcing a full document
  reload rather than a client navigation.
- [X] T313 `tests/ui/scroll-behaviour.spec.ts` — 19 assertions pinning the convention, including
  that `scroll={false}` is written in exactly one file and that no page uses a raw anchor for an
  internal route.
- [X] T314 Payload-level verification (the browser pane here does not complete streaming hydration,
  so runtime checks are unreliable in it): `scroll:false` reaches `next/link` for exactly the
  intended links and no others, across all eight routes.

## Not done

- [ ] T280 Live human 30-second storytelling test. Needs a reader who has not seen the data; the
  mechanism it depends on is verified (the cold-open feed spans five distinct rules and the largest
  callout names the mechanism and its rupee value), but the test itself is not something an
  implementer can perform on their own work.
- [ ] T281 Deploy to Vercel. Hard-to-reverse and externally visible; needs the user's own account
  and their explicit go-ahead. The build is clean and requires no environment variables.
- [ ] T282 Automated audit with a dedicated tool (axe-core or similar). The audit performed was
  hand-written against the rendered DOM and covers contrast, accessible naming, heading order and
  overflow — it found and fixed real defects, but it is not a substitute for a full ruleset. A
  keyboard traversal pass by a person is also still outstanding.
