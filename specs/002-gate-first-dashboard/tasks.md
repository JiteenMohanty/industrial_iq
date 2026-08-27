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
- [X] T261 Test suite: 226 passing across 34 files, including new suites for gates, models,
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
