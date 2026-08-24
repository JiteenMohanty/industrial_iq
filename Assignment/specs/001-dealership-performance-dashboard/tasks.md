---

description: "Task list for Dealership Performance Dashboard (DealerPulse)"
---

# Tasks: Dealership Performance Dashboard (DealerPulse)

**Input**: Design documents from `/specs/001-dealership-performance-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **REQUIRED, not optional.** Constitution Principle V is marked NON-NEGOTIABLE and
mandates Vitest coverage of `src/lib/analytics/` and `src/lib/insights/` asserting real dataset
fixtures. Test tasks below are therefore mandatory, not illustrative.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: `[US1]`–`[US5]`, mapping to the prioritized user stories in spec.md
- Exact file paths are given in every task

## Path Conventions

Application root is `C:\Projects\Assignment\Assignment` (ADR-0001). All paths below are relative
to it. Source in `src/`, tests in `tests/`, decision records in `docs/decisions/`.

## Decision-logging convention

Tasks that involve a non-trivial choice carry this line verbatim:

> **log this decision in decision-log.md before marking task complete.**

That is a Constitution requirement (Decision Records section), not a suggestion. Entry format:
date · phase/task ref · decision · reasoning · alternatives considered. Structural choices also
need an ADR in `docs/decisions/architecture-decisions.md`.

---

## Phase 0: Blocking Governance Prerequisite

**Purpose**: Resolve the Constitution/data contradiction found during planning. Phase 2 test work
cannot honestly proceed until this clears.

- [X] T001 Amend Constitution Principle V in `.specify/memory/constitution.md` via `/speckit-constitution`, replacing the pinned fixture "Group target attainment ≈ 13%" with "≈ 11.2% by units (160 of 1,426)". The source `plan.md` §2 figure is arithmetically wrong (160 ÷ 1,426 = 11.22%); see [ADR-0009](../../docs/decisions/architecture-decisions.md#adr-0009-group-target-attainment-is-112-not-13). **This is a user-run command — do not attempt to edit the constitution directly.** Blocks T029.

**Checkpoint**: Constitution and dataset agree. Fixtures can now be written honestly.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization. Nothing here depends on the dataset's contents.

- [X] T002 Scaffold Next.js 15 App Router + TypeScript project at repository root, creating `package.json`, `next.config.ts`, `app/` entry. Use the App Router, not Pages Router.
- [X] T003 Configure `tsconfig.json` with `"strict": true`, `noUncheckedIndexedAccess`, and the `@/*` → `src/*` path alias. Constitution forbids deep relative import chains.
- [X] T004 [P] Install and configure Tailwind CSS 4 in `src/app/globals.css` and `postcss.config.mjs`.
- [X] T005 [P] Install Recharts 2 and the `server-only` package as dependencies.
- [X] T006 [P] Configure Vitest in `vitest.config.ts` with the `@/*` alias resolved, `environment: 'node'` (no DOM — analytics tests only), and `tests/` as the root.
- [X] T007 [P] Configure ESLint and Prettier in `eslint.config.mjs` and `.prettierrc`.
- [X] T008 Copy `../docs/dealership_data.json` to `src/data/dealership_data.json`. **Do not modify or move the original** — `../docs/` stays untouched per plan.md §4.
- [X] T009 [P] Add npm scripts to `package.json`: `dev`, `build`, `start`, `lint`, `test` (`vitest run`), `test:watch`.

**Checkpoint**: `npm run dev` serves a blank app; `npx vitest run` runs zero tests successfully.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The data, time, format, filter, and context layers every user story depends on, plus
the design-system primitives and app shell.

**⚠️ CRITICAL**: No user story work can begin until this phase completes.

### Types and core utilities

- [X] T010 [P] Define raw dataset types in `src/lib/data/types.ts` — `RawBranch`, `RawRep`, `RawStatusEntry`, `RawLead`, `RawTarget`, `RawDelivery`, `RawDataset` — mirroring the JSON exactly per [data-model.md §2](./data-model.md).
- [X] T011 [P] Define closed domain unions in `src/lib/data/types.ts` — `Stage`, `LeadStatus`, `Source`, `RepRole`, `Severity` — plus the ordered `FUNNEL_STAGES` tuple. Model as string-literal unions, never `string`, so a rule typo fails at compile time.
- [X] T012 Define enriched types in `src/lib/data/types.ts` — `EnrichedLead`, `EnrichedDelivery`, `Branch`, `Rep` — with every derived field from [data-model.md §3](./data-model.md).
- [X] T013 Implement `src/lib/time.ts`: compute `DATA_AS_OF` as the max timestamp across lead `created_at`, `last_activity_at`, and `status_history[].timestamp` (expect `2025-12-31T19:10:00Z`); expose `REAL_NOW`; implement `daysBetween` flooring both operands to UTC date. **`DATA_AS_OF` must be computed, never hardcoded** (Constitution VII). `REAL_NOW` is used only by the freshness banner — nothing else may read the system clock.
- [X] T014 Implement `src/lib/format.ts`: Indian lakh/crore currency (`₹8.59 Cr`, never `₹85,900,000`), percentages, dates, and signed deltas with comparison basis. Choose and document the lakh↔crore crossover point and rounding precision. **log this decision in decision-log.md before marking task complete.**

### Dataset layer

- [X] T015 Implement parsing and enrichment in `src/lib/data/dataset.ts`: sort `status_history` ascending defensively, derive `stageTimestamps` (first occurrence per stage), `reachedStages`, `currentStage`, `isLost`, `lostFromStage`, `isOpen`, `isStuckOrder`, `ageDays`, `daysSinceActivity`, `daysSinceOrder`, and join `delivery`.
- [X] T016 Add ingest assertions to `src/lib/data/dataset.ts`: `status_history` non-empty and starting at `new`; `assigned_to`/`branch_id` resolve (hard error, never a silent drop — dropping corrupts every denominator); all 160 `delivered` leads have a delivery; all 38 `order_placed` leads do not; supplied `days_to_deliver` agrees with the date difference.
- [X] T017 Build the indexes and memoise in `src/lib/data/dataset.ts`: `leadById`, `leadsByBranch`, `leadsByRep`, `deliveryByLeadId`, `targetsByBranchMonth`, `repById`, `branchById`. Parse once at module scope, wrap `getDataset()` in React `cache()`, and add the `server-only` import so a client-component import fails the build (Constitution I, ADR-0003).

### Filters and context

- [X] T018 [P] Define `Filters` and `TimePreset` in `src/lib/filters/types.ts` per [data-model.md §5](./data-model.md).
- [X] T019 Implement `parseFilters()` in `src/lib/filters/parse.ts` as a **total function that never throws** — unknown preset, malformed dates, inverted range, and unknown branch all degrade to defaults per [contracts/url-state.md](./contracts/url-state.md). Rolling presets anchor to `DATA_AS_OF`, not the system clock.
- [X] T020 Implement `buildHref()` in `src/lib/filters/parse.ts` — the only sanctioned way to construct an internal link, guaranteeing FR-029 filter preservation on drill-through.
- [X] T021 Implement `applyFilters()` in `src/lib/filters/apply.ts`: leads filtered on `created_at`, deliveries on `delivery_date` (FR-030 — different date fields, deliberately).
- [X] T022 Implement `buildContext()` in `src/lib/analytics/context.ts` producing all three scopes — `leads`/`deliveries` (windowed), `detectionLeads` (branch-filtered only), `groupLeads`/`groupDeliveries` (unfiltered) — plus `priorLeads`, `priorDeliveries`, `hasPriorPeriod`. See [ADR-0005](../../docs/decisions/architecture-decisions.md#adr-0005-analyticscontext-carries-three-distinct-scopes). **This is the most likely source of a silent correctness bug in the build** — confusing the scopes breaks FR-009/FR-009a/FR-030 invisibly. Wrap in React `cache()`.

### Foundational tests

- [X] T023 [P] Create `tests/fixtures.ts` holding every verified number from [data-model.md §9](./data-model.md) in one place. Import from here — never inline a fixture in a spec file.
- [X] T024 [P] Write `tests/data/dataset.spec.ts`: 510 leads load; funnel counts by `reachedStages` are 510/391/300/235/198/160; all ingest assertions hold; indexes resolve.
- [X] T025 [P] Write `tests/lib/time.spec.ts`: `DATA_AS_OF` equals `2025-12-31T19:10:00Z`; `daysBetween` floors to UTC date so a threshold-boundary comparison is stable regardless of time of day.
- [X] T026 [P] Write `tests/lib/format.spec.ts`: crore/lakh rendering, delta direction and basis, zero and negative cases.
- [X] T027 [P] Write `tests/filters/parse.spec.ts`: every degradation case from the url-state contract; plus the round-trip property `parseFilters(buildHref(p, f)) ≡ f`.
- [X] T028 Write `tests/analytics/context.spec.ts` asserting scope separation explicitly: a time-narrowed context leaves `detectionLeads` unchanged; a branch-filtered context narrows `detectionLeads` but **not** `groupLeads`; `hasPriorPeriod` is false when the prior window falls outside coverage.
- [X] T029 Run `npx vitest run` and confirm the foundational suite is green. Requires T001 (attainment fixture) to be settled first.

### Design system and shell

- [X] T030 Load the `dataviz` skill and define the palette, type scale, and severity colours in `src/app/globals.css` and a `src/lib/theme.ts`. Must satisfy WCAG 2.1 AA contrast (≥4.5:1 body, ≥3:1 large/UI) and encode severity with a non-colour cue as well as colour. **log this decision in decision-log.md before marking task complete.**
- [X] T031 [P] Build UI primitives in `src/components/ui/`: `Card`, `StatTile`, `Badge`, `DataTable`, `EmptyState`, `Skeleton`, `Sheet`. Tabular numerals on all figures.
- [X] T032 Build the app shell in `src/app/layout.tsx`: nav, filter-bar slot, and the freshness banner reading "Data as of 31 Dec 2025 · N months behind live" from `time.ts`. Banner appears on every route (FR-031).
- [X] T033 [P] Add `loading.tsx` skeletons for every route under `src/app/`.

**Checkpoint**: Foundation ready. `getDataset()` returns enriched, indexed data; contexts build
correctly; the shell renders. User story work can begin.

---

## Phase 3: User Story 1 — Cold-open triage (Priority: P1) 🎯 MVP

**Goal**: A reader who has never seen the data opens `/` and learns within 30 seconds that
Lakeside Toyota is failing at first contact — with the money attached, the evidence one click
away, and a call list they can take with them.

**Independent Test**: Open `/` with no query params and no prior knowledge. The top 5 ranked
alerts are visible without scrolling, the highest concerns Lakeside's contact coverage, clicking
it lands on the supporting records with filters intact, and requesting its call list downloads a
CSV that opens in Excel.

### Insight foundations

- [X] T034 [US1] Define `Insight`, `Severity`, `InsightRuleSlug`, and the `InsightRule` interface in `src/lib/insights/types.ts` per [data-model.md §7](./data-model.md). `evidence` and `href` are required, never optional. `impactRupees: null` must stay distinct from `0`.
- [X] T035 [US1] Define all nine thresholds as named constants in `src/lib/insights/thresholds.ts` per [contracts/insight-rules.md](./contracts/insight-rules.md). Import these in both rules and tests — never inline a threshold at a call site.

### Tests for User Story 1 ⚠️ Write these first and confirm they fail

- [X] T036 [P] [US1] `tests/insights/never-contacted.spec.ts` — fires for B3 with 33 leads; does not fire below the 5-lead minimum.
- [X] T037 [P] [US1] `tests/insights/contact-rate.spec.ts` — fires for B3 at 58.2%; **must be silent for B1, B2, B4, B5** (78.0–82.5%); excludes entities under 15 leads.
- [X] T038 [P] [US1] `tests/insights/stuck-orders.spec.ts` — 25 of the 38 stuck orders are ≥27 days and alert; the other 13 do not. Assert both numbers so the two sets never get conflated (research R4).
- [X] T039 [P] [US1] `tests/insights/cold-leads.spec.ts` — severity steps correctly at the 7 / 14 / 30-day marks.
- [X] T040 [P] [US1] `tests/insights/funnel-collapse.spec.ts` — fires for B3 (7.6% delivered vs group 31.4%); silent for branches within 15pp.
- [X] T041 [P] [US1] `tests/insights/rep-outlier.spec.ts` — fires for a rep ≥15pp below branch average; a rep with fewer than 15 leads is excluded entirely (FR-011a), not caveated.
- [X] T042 [P] [US1] `tests/insights/lost-reason.spec.ts` — **asserts the rule runs and may return `[]`**. Zero findings is correct on this extract (research R7); do not lower the threshold to manufacture alerts.
- [X] T043 [P] [US1] `tests/insights/channel-quality.spec.ts` — fires for `social_media` alone (13.9% at 14.1% share); all five other channels clear the 20% floor.
- [X] T044 [P] [US1] `tests/insights/delay-reason.spec.ts` — asserts the rule runs; may return `[]`.
- [X] T045 [P] [US1] `tests/insights/engine.spec.ts` — ordering is a **total** order (severity → impact desc, `null` last → `id` asc); a Lakeside (B3) insight ranks first on an unfiltered context; two runs over the same context produce identical `id` sequences (FR-010).
- [X] T046 [P] [US1] `tests/analytics/kpis.spec.ts` — delivered units 160, revenue ₹38.88 Cr, attainment **11.2%**, conversion rate; delta is `null` when `hasPriorPeriod` is false; every rate returns `null`, not `NaN`, on a zero denominator.
- [X] T047 [P] [US1] `tests/analytics/trends.spec.ts` — deliveries by month Jul 16 · Aug 18 · Sep 24 · Oct 20 · Nov 30 · Dec 52.
- [X] T048 [P] [US1] `tests/export/csv.spec.ts` — UTF-8 BOM present, CRLF endings, fields with commas/quotes escaped per RFC 4180, rupees as bare integers, phone numbers quoted.

### Implementation for User Story 1

- [X] T049 [P] [US1] Implement rule 1 in `src/lib/insights/rules/never-contacted.ts`. Reads `ctx.detectionLeads`, compares against `ctx.groupLeads`.
- [X] T050 [P] [US1] Implement rule 2 in `src/lib/insights/rules/contact-rate.ts`.
- [X] T051 [P] [US1] Implement rule 3 in `src/lib/insights/rules/stuck-orders.ts`.
- [X] T052 [P] [US1] Implement rule 4 in `src/lib/insights/rules/cold-leads.ts`.
- [X] T053 [P] [US1] Implement rule 5 in `src/lib/insights/rules/funnel-collapse.ts`.
- [X] T054 [P] [US1] Implement rule 6 in `src/lib/insights/rules/rep-outlier.ts`.
- [X] T055 [P] [US1] Implement rule 7 in `src/lib/insights/rules/lost-reason.ts`.
- [X] T056 [P] [US1] Implement rule 8 in `src/lib/insights/rules/channel-quality.ts`.
- [X] T057 [P] [US1] Implement rule 9 in `src/lib/insights/rules/delay-reason.ts`.
- [X] T058 [US1] Write the plain-English `body` copy for all nine rules, each stating the threshold breached and the value that breached it, so no alert asks to be taken on trust (FR-011). Tone and phrasing are a product decision. **log this decision in decision-log.md before marking task complete.**
- [X] T059 [US1] Implement `runInsights()` in `src/lib/insights/engine.ts`: run all nine, concatenate, sort by the total order, assign `id = ${slug}:${entityId}`, return the **full** ranked list. Truncation to 5 is a presentation concern and does not belong here — the CSV endpoint and branch pages need the whole list.
- [X] T060 [US1] Implement `computeKpis()` in `src/lib/analytics/kpis.ts` per [contracts/analytics-api.md](./contracts/analytics-api.md). Attainment excludes branch-months with no target row from the denominator — never zero-fills. Carries the mandatory FR-003 caveat.
- [X] T061 [P] [US1] Implement `computeMonthlyTrend()` and `computeBranchSparklines()` in `src/lib/analytics/trends.ts`.
- [X] T062 [P] [US1] Build `src/components/insights/InsightCard.tsx` — severity badge (colour **plus** a non-colour cue), title, body, rupee impact, drill-through link via `buildHref()`, and the call-list download control.
- [X] T063 [US1] Build `src/components/insights/InsightFeed.tsx` — renders the top 5, states the count of the remainder, and reveals the full list behind a single control gated on `?insights=all` (FR-007a). Also renders the FR-009b "no detected problems" state.
- [X] T064 [P] [US1] Build the KPI row in `src/components/ui/StatTile.tsx` usage — five tiles with deltas, direction, comparison basis, and the attainment caveat. Suppress the delta entirely when `hasPriorPeriod` is false rather than showing a partial comparison.
- [X] T065 [P] [US1] Build `src/components/charts/TrendChart.tsx` (client component). Accepts a small pre-computed series array — **never a lead collection** (Constitution I).
- [X] T066 [P] [US1] Build the compact branch comparison table with sparklines in `src/components/charts/ComparisonBar.tsx` and a `DataTable` usage.
- [X] T067 [US1] Assemble `src/app/page.tsx` (Overview) as a Server Component: freshness banner, KPI row, Action Center feed as the visual anchor, trend chart, branch table. Decide the visual hierarchy so the feed anchors the page and the Lakeside story is legible in 30 seconds (SC-001). **log this decision in decision-log.md before marking task complete.**
- [X] T068 [P] [US1] Implement `toCsv()` and `buildCallListRows()` in `src/lib/export/csv.ts` — pure functions, fixed ten-column shape, per [contracts/call-list-csv.md](./contracts/call-list-csv.md).
- [X] T069 [US1] Implement the route handler in `src/app/api/call-list/route.ts`: parse filters, build context, run engine, resolve insight by `id`, map `evidence` through `leadById`, serialise, set `Content-Disposition` with the `dealerpulse-<slug>-<entity>-<date>.csv` filename. 404 on unknown id, 400 on missing `insight`. See [ADR-0006](../../docs/decisions/architecture-decisions.md#adr-0006-csv-call-list-delivered-by-a-server-route-handler) — this deviates from `plan.md` §4.3 deliberately.
- [X] T070 [US1] Run `npx vitest run` and confirm all US1 tests pass. Then manually verify: `/` cold open ranks a Lakeside (B3) insight first.

**Checkpoint**: US1 is a complete, demonstrable MVP. The product tells its central story and hands
over a call list.

---

## Phase 4: User Story 2 — Recover money stuck in undelivered orders (Priority: P2)

**Goal**: A branch manager sees every order placed and never delivered, ranked so the oldest and
largest sit on top, with ₹8.59 Cr shown as a single headline figure and the delay reasons behind it.

**Independent Test**: Open `/deliveries` directly. It lists all 38 undelivered placed orders
ranked by age and value, shows the ₹8.59 Cr aggregate, breaks down delay reasons, and shows
delivery-time distribution and per-branch performance.

### Tests for User Story 2 ⚠️

- [X] T071 [P] [US2] `tests/analytics/pipeline.spec.ts` — `computeStuckOrders` returns **all 38** (not the 25 that alert), totalling ₹8.59 Cr; oldest is 195 days; aging buckets at 7/14/30.
- [X] T072 [P] [US2] `tests/analytics/deliveries.spec.ts` — average 18.3 days (min 7, max 39); 72 of 160 delayed; delay-reason counts.

### Implementation for User Story 2

- [X] T073 [P] [US2] Implement `computeStuckOrders()`, `computeOpenPipeline()`, `computeAgingBuckets()` in `src/lib/analytics/pipeline.ts`. Stuck orders sorted by `daysSinceOrder` desc then `deal_value` desc, with **both components visible on every row** so the reader can verify the ordering. The exact age×value combination is a judgement call. **log this decision in decision-log.md before marking task complete.**
- [X] T074 [P] [US2] Implement `computeDeliveryOps()`, `computeDelayReasons()`, `computeDeliveryByBranch()` in `src/lib/analytics/deliveries.ts`.
- [X] T075 [P] [US2] Build the stuck-order watchlist table in `src/components/leads/LeadTable.tsx` with age and value columns and drill-through to the lead sheet.
- [X] T076 [P] [US2] Build the delay-reason breakdown and days-to-deliver distribution charts in `src/components/charts/StageMix.tsx`. Chart form for a 7-category breakdown and for a duration distribution are both real choices — the `dataviz` skill's form heuristic applies. **log this decision in decision-log.md before marking task complete.**
- [X] T077 [US2] Assemble `src/app/deliveries/page.tsx`: ₹8.59 Cr headline over 38 orders, watchlist, delay breakdown, distribution, branch delivery performance.
- [X] T078 [US2] Verify the ₹8.59 Cr headline counts all 38 while the stuck-order alert still reports 25. Conflating these is the specific bug research R4 exists to prevent.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Find where the funnel leaks (Priority: P3)

**Goal**: An operations lead sees the group funnel with per-stage drop-off, overlays a single
branch to spot divergence, and reads loss reasons and channel quality beside it.

**Independent Test**: Open `/funnel`. The group funnel renders 510 → 391 → 300 → 235 → 198 → 160
with drop-off percentages, a branch can be overlaid, and loss reasons and channel conversion are
shown.

### Tests for User Story 3 ⚠️

- [X] T079 [P] [US3] `tests/analytics/funnel.spec.ts` — group funnel by `reachedStages` (not current `status`); per-stage drop-off; B3 overlay diverges as expected; `computeLossBreakdown` returns new 112 · contacted 75 · test_drive 55 · negotiation 32 (status_history-derived, see decision-log.md).
- [X] T080 [P] [US3] `tests/analytics/channels.spec.ts` — social_media 13.9%, walk_in 45.7%, and the four others per fixtures.

### Implementation for User Story 3

- [X] T081 [P] [US3] Implement `computeFunnel()`, `computeStageDurations()`, `computeLossBreakdown()` in `src/lib/analytics/funnel.ts`. Stage membership comes from `reachedStages` — **never from `status` alone** (Constitution III, FR-017).
- [X] T082 [P] [US3] Implement `computeChannelPerformance()` in `src/lib/analytics/channels.ts`.
- [ ] T083 [P] [US3] Build `src/components/charts/FunnelChart.tsx` (client component) with per-stage counts and drop-off labels. Choose the funnel's visual form — the `dataviz` skill's form heuristic applies. **log this decision in decision-log.md before marking task complete.** — CODE WRITTEN, decision logged (two-line-series-indexed-to-%-of-top). `npx tsc --noEmit` was clean with this file present. NOT yet verified by `npm run build` or a browser smoke test — resume by running the build.
- [ ] T084 [US3] Add the branch-overlay toggle to `FunnelChart`, rendering the selected branch against the group baseline so divergence is visible without arithmetic (FR-013). — CODE WRITTEN inline in `src/app/funnel/page.tsx` (an `?overlay=<branchId>` param, deliberately separate from the shared branch filter — see that file's comment). Same unverified status as T083.
- [ ] T085 [P] [US3] Build the stage-duration strip and the loss-reason / source-quality side cards. — CODE WRITTEN inline in `src/app/funnel/page.tsx` (stage-duration Card strip + two DataTable side-by-side sections for loss reasons and channel quality). Same unverified status as T083.
- [ ] T086 [US3] Assemble `src/app/funnel/page.tsx`. — FILE WRITTEN (`src/app/funnel/page.tsx` + `src/app/funnel/loading.tsx`), `npx tsc --noEmit` clean. **`npm run build` was started and interrupted before completing — this is the actual next step.** Given the format.ts/time.ts `server-only` incident earlier in this session (a real bug `tsc --noEmit` did not catch but `npm run build` did), do not treat the clean typecheck as proof this page works — run the full build, then `npx vitest run` for a full-suite regression check, then a browser/curl smoke test of `/funnel` (plain, `?overlay=B3`, and a narrow/zero-result filter) before marking T083-T086 done.

**Checkpoint**: US1–US3 all work independently.

---

## Phase 6: User Story 4 — Compare branches, drill to the individual (Priority: P4)

**Goal**: Rank the five branches, open one to see its metrics, funnel, alerts and reps, then reach
a rep's assigned leads and a single lead's full stage history.

**Independent Test**: Open `/branches`, select a branch, then a rep, then a lead. Each level shows
metrics scoped to that entity; the lead detail shows the complete `status_history` timeline.

### Tests for User Story 4 ⚠️

- [ ] T087 [P] [US4] `tests/analytics/reps.spec.ts` — per-rep metrics; `computeRepDetail` returns `null` for an unknown id rather than throwing, so the route can render not-found.

### Implementation for User Story 4

- [ ] T088 [P] [US4] Implement `computeRepPerformance()` and `computeRepDetail()` in `src/lib/analytics/reps.ts`.
- [ ] T089 [P] [US4] Build `src/app/branches/page.tsx` — comparison grid, all branches on comparable metrics with recent trend. Which metrics earn a column, and the default sort, determine what the CEO concludes at a glance. **log this decision in decision-log.md before marking task complete.**
- [ ] T090 [US4] Build `src/app/branches/[branchId]/page.tsx` — branch KPIs, its funnel against the group, its own alerts (reusing `InsightFeed`), and its rep table.
- [ ] T091 [US4] Build `src/app/reps/[repId]/page.tsx` — rep KPIs, funnel, and assigned leads with aging.
- [ ] T092 [P] [US4] Build `src/components/leads/LeadDetailSheet.tsx` — the full `status_history` timeline in chronological order, including each entry's note. This is the drill-down floor and the strongest storytelling moment in the product; treat the timeline design as a product decision. **log this decision in decision-log.md before marking task complete.**
- [ ] T093 [US4] Add not-found states for unknown `branchId` and `repId` via `not-found.tsx` in each dynamic segment.

**Checkpoint**: All drill-down paths work; a reader can go from a group figure to one lead's
history.

---

## Phase 7: User Story 5 — Scope and share the view (Priority: P5)

**Goal**: Every view can be narrowed by time range and branch, the URL reproduces exactly what
you are looking at, and the data's coverage is always stated.

**Independent Test**: Change the time range and branch on each view, confirm every figure
recomputes and the URL updates, then open the copied URL in a fresh session and confirm identical
figures.

**Note**: `parseFilters`/`buildHref` were built in Phase 2 because every story depends on them.
This phase adds the interactive controls and the filter-dependent behaviours.

### Tests for User Story 5 ⚠️

- [ ] T094 [P] [US5] `tests/filters/scoping.spec.ts` — applying a time range leaves insight output **unchanged** (FR-009); applying a branch filter narrows `detectionLeads` and therefore the feed (FR-009a) while comparative rules still report the group figure.

### Implementation for User Story 5

- [ ] T095 [P] [US5] Build `src/components/filters/TimeRangeFilter.tsx` (client) with exactly the presets from FR-026: last 30 days, last 90 days, each month Jun–Dec 2025, full range, custom. Rolling presets anchor to `DATA_AS_OF`.
- [ ] T096 [P] [US5] Build `src/components/filters/BranchFilter.tsx` (client).
- [ ] T097 [US5] Wire both controls into the shell filter bar in `src/app/layout.tsx`, pushing to the URL via `buildHref()`. No client filter store, no context provider (Constitution VI).
- [ ] T098 [US5] Verify branch-scoped alerting end to end: selecting a branch narrows the feed; comparative alerts retain the group figure they are measured against; a branch with no problems shows the FR-009b message rather than an empty region.
- [ ] T099 [US5] Add genuine `EmptyState` rendering to every view for filtered-to-zero, and confirm no view produces `NaN`, `Infinity`, or a `₹0` presented as fact (SC-006).

**Checkpoint**: All five user stories complete and independently demonstrable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T100 Responsive pass at 1440px, 1024px, and 768px: nav collapses under `lg`, KPI grid 4→2, charts reflow, tables become card lists. No horizontal page scroll at any width (SC-009).
- [ ] T101 Accessibility pass to WCAG 2.1 AA (FR-037, SC-009a): contrast ≥4.5:1 body and ≥3:1 large/UI, full keyboard traversal with visible focus, accessible names on every control and chart, no information by colour alone. Run an automated audit **and** a manual keyboard pass — automated tools miss focus order and colour-alone encoding.
- [ ] T102 Run `npm run build`, then confirm the dataset is absent from every client chunk by grepping `.next/static` for `"Lakeside Toyota"` and `"customer_name"`. Both must return nothing. This is the hard constitutional gate (Principle I) — a match means the `server-only` guard is missing.
- [ ] T103 [P] Write `DECISIONS.md` at the repository root — the reviewer-facing narrative deliverable required by the assignment brief. Distinct from `docs/decisions/`: curated for a reader, not a working log. Must document the per-metric time semantics from FR-030, and should surface the two corrected `plan.md` figures (attainment 11.2%, losses-at-`new` 120) as evidence the analytics were verified rather than assumed. Selecting what earns a place here is an editorial judgement. **log this decision in decision-log.md before marking task complete.**
- [ ] T104 [P] Write `README.md` — setup, run, test, and the Vercel Root Directory requirement.
- [ ] T105 Review `docs/decisions/decision-log.md` for completeness against every task above carrying the logging reminder. A phase is not done until its decisions are recorded (Constitution, Development Workflow gate 4).
- [ ] T106 Work through all seven gates in [quickstart.md](./quickstart.md), including the 15-step route walkthrough.
- [ ] T107 Run the SC-001 storytelling acceptance test: show `/` to someone who has not seen the data and confirm they name the failing branch and the reason within 30 seconds, unprompted. This is 20% of the assignment score and is not fixable by adding charts.
- [ ] T108 Deploy to Vercel with **Root Directory set to `Assignment`** (ADR-0001 — the git root is one level above the application; without this the build cannot find `package.json`). Verify the live URL renders identically to the local production build.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 0 (T001)**: Blocks T029 and all fixture-asserting tests. Everything else can proceed.
- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks all user stories.**
- **Phases 3–7 (User Stories)**: All depend on Phase 2. Then independent of each other.
- **Phase 8 (Polish)**: Depends on the stories you intend to ship.

### Critical path within Phase 2

`T010/T011 → T012 → T015 → T016 → T017 → T022`. The dataset singleton and the three-scope context
are the spine; nothing computes before them. T013 (`time.ts`) must land before T015 because
enrichment needs `DATA_AS_OF` to derive ages.

### User story dependencies

- **US1 (P1)**: Foundational only. Delivers a standalone MVP.
- **US2 (P2)**: Foundational only. Reuses `LeadDetailSheet` if US4 has landed, but does not require it.
- **US3 (P3)**: Foundational only.
- **US4 (P4)**: Foundational only. Reuses `InsightFeed` from US1 for branch-level alerts — build US1 first if doing both.
- **US5 (P5)**: Foundational only, but its value is visible only once at least one story renders. T098 verifies behaviour introduced in US1.

### Within each story

Tests → analytics/rules → components → page assembly. Tests must be written and failing before
implementation (Constitution V).

### Parallel opportunities

- Phase 1: T004–T007, T009 in parallel.
- Phase 2: T010/T011 together; T018 alongside T013/T014; the whole test block T023–T027 in parallel; T031/T033 alongside T030.
- Phase 3: all nine rule tests (T036–T044) in parallel; all nine rule implementations (T049–T057) in parallel; T062/T064/T065/T066/T068 in parallel.
- Phase 4–7: analytics and component tasks marked [P] within each phase.
- Across phases: with multiple developers, US2/US3/US4 can run concurrently once Phase 2 closes.

---

## Parallel Example: User Story 1

```bash
# All nine rule tests together (they fail — that is the point):
Task: "tests/insights/never-contacted.spec.ts"
Task: "tests/insights/contact-rate.spec.ts"
Task: "tests/insights/stuck-orders.spec.ts"
Task: "tests/insights/cold-leads.spec.ts"
Task: "tests/insights/funnel-collapse.spec.ts"
Task: "tests/insights/rep-outlier.spec.ts"
Task: "tests/insights/lost-reason.spec.ts"
Task: "tests/insights/channel-quality.spec.ts"
Task: "tests/insights/delay-reason.spec.ts"

# Then all nine rule implementations together:
Task: "src/lib/insights/rules/never-contacted.ts"
Task: "src/lib/insights/rules/contact-rate.ts"
# … through delay-reason.ts
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 0 — clear the constitution amendment (T001).
2. Phase 1 — Setup.
3. Phase 2 — Foundational. **Blocks everything; do not shortcut it.**
4. Phase 3 — US1.
5. **STOP and VALIDATE**: `/` tells the Lakeside story in 30 seconds, alerts drill through, CSV downloads.
6. Deployable at this point.

### Incremental delivery

Setup + Foundational → US1 (MVP, deploy) → US2 (deploy) → US3 → US4 → US5 → Polish. Each story
adds value without breaking the previous ones.

### Recommended scope if time is short

US1 + US2 + US5 covers the two expensive findings (never-contacted leads, ₹8.59 Cr stuck) and
makes them shareable. US3 and US4 are diagnostic depth — valuable, and US4's rep drill-down is a
hard requirement of the brief, so drop US3 before US4 if forced to choose.

---

## Notes

- `[P]` = different files, no dependency on incomplete work.
- Tests must fail before implementation. A test that passes immediately is testing nothing.
- **Never adjust a fixture to make a test pass.** Constitution V requires a decision-log entry
  explaining any fixture change *before* it is made. A failing fixture means the analytics are
  wrong, not the number.
- Commit after each task or logical group.
- Ten tasks carry the decision-logging reminder: T014, T030, T058, T067, T073, T076, T083, T089,
  T092, T103. The obligation attaches to the decision, not to the label — if a real choice arises
  in a task this list did not anticipate, it still gets logged.
