# Decision Log

Running development journal. **Append-only, chronological.** Every implementation decision made
during `/speckit-implement` is recorded here: library choice, naming, tradeoff, or deviation from
`plan.md`.

Entries are never edited or deleted. A reversal is a new entry referencing the old one.

Structural decisions get a formal ADR in [architecture-decisions.md](./architecture-decisions.md)
instead of — or in addition to — an entry here.

**Entry format**: Date · Phase/task ref · Decision · Reasoning · Alternatives considered

---

## 2026-08-24 · Planning (`/speckit-plan`)

### Verified every figure in `plan.md` §2 against the dataset before designing against them

**Decision**: Recompute all thirteen headline figures directly from `docs/dealership_data.json`
rather than trusting the source plan.

**Reasoning**: Constitution Principle V pins several of them as mandatory test fixtures, and
Principle III makes published numbers a correctness concern rather than a presentation one. A wrong
fixture would have been written into the test suite and defended by it.

**Alternatives considered**: Trusting `plan.md` and verifying during implementation — rejected;
the error would have surfaced after tests were written against it, when it is far more expensive
to unpick.

**Outcome**: Eleven of thirteen figures correct. Two wrong — see the next two entries.

### Group target attainment corrected from ≈13% to 11.2%

**Decision**: Attainment is 11.2% by units (160 ÷ 1,426). Spec SC-003 corrected. Constitution
Principle V requires amendment.

**Reasoning**: `plan.md` §2's own stated inputs contradict its stated output. Revenue attainment
(12.4%) does not round to 13% either, so this is arithmetic error, not a definitional difference.

**Alternatives considered**: Redefining attainment as revenue-based to land nearer 13% — rejected;
still not 13%, and fitting a definition to a wrong number inverts Principle III.

**See**: [ADR-0009](./architecture-decisions.md#adr-0009-group-target-attainment-is-112-not-13).
**Blocks**: test phase, until `/speckit-constitution` amends Principle V.

### Losses at `new` corrected from 118 to 120; oldest stuck order from 195 to 194 days

**Decision**: Loss distribution is new 120 · contacted 79 · test_drive 57 · negotiation 32
(total 288). Oldest stuck order is 194 days from `DATA_AS_OF`.

**Reasoning**: Both computed directly. The loss breakdown is displayed (FR-015) and would be
asserted in tests; the 194/195 difference is presentational but should not be published wrong.

**Alternatives considered**: None — arithmetic.

### "38 stuck orders" and "the stuck-order alert" are two different sets

**Decision**: Name and maintain both. All 38 undelivered placed orders make the ₹8.59 Cr headline
(FR-018/019); the 25 that are ≥27 days old fire insight rule 3 (FR-011).

**Reasoning**: SC-003 pins 38 while FR-011 rule 3 fires at ≥27 days. A reader could implement one
and test the other. Naming both prevents a plausible and hard-to-spot bug.

**Alternatives considered**: Lowering rule 3's threshold to 0 so the sets coincide — rejected; 27
days is the user-selected threshold and an alert on yesterday's order is noise.

### `DATA_AS_OF` scans lead timestamps, not delivery dates

**Decision**: `DATA_AS_OF` = max across lead `created_at`, `last_activity_at`, and
`status_history[].timestamp` = 2025-12-31T19:10:00Z. Age comparisons floor both operands to UTC
date.

**Reasoning**: Lead timestamps run later than the latest `delivery_date` (2025-12-30). Scanning
deliveries alone would place `DATA_AS_OF` a day early and shift every age calculation. Day-flooring
stops a rule sitting exactly on its threshold from flipping based on time of day.

**Alternatives considered**: `metadata.generated_at` (2026-03-03) — rejected; that is when the file
was written, not what it covers, and would corrupt every age figure.

### Rolling time presets anchor to `DATA_AS_OF`, not the system clock

**Decision**: "Last 30 days" and "last 90 days" count back from `DATA_AS_OF`.

**Reasoning**: Today is 2026-08-24; the data ends 2025-12-31. Anchored to the real clock, the two
most prominent presets would permanently show empty states.

**Alternatives considered**: Dropping the rolling presets — rejected; they are specified in
`plan.md` §4.3 and FR-026, and they work correctly once anchored properly.

### Insight rules 7 and 9 may legitimately return no findings

**Decision**: Accept `[]` as valid output. Tests assert the rule runs and returns `[]`, not that it
emits findings.

**Reasoning**: 8 lost reasons spread across ~58 losses per branch rarely reach 40% concentration;
rule 9 is borderline at ~14 delayed deliveries per branch. Both thresholds were user-selected and
are correct — the data simply does not exhibit those patterns.

**Alternatives considered**: Lowering thresholds until they fire — rejected; manufacturing alerts
to justify a rule is precisely the dishonesty Principle III forbids.

### Application root is the Spec Kit directory

**Decision**: Build at `C:\Projects\Assignment\Assignment`. Vercel Root Directory must be set to
`Assignment`.

**Reasoning**: Keeps everything inside the working directory `/implement` runs in and keeps every
Constitution path accurate.

**See**: [ADR-0001](./architecture-decisions.md#adr-0001-application-root-is-the-spec-kit-directory-not-the-git-root).

### CSV call list is a server route handler — deviation from `plan.md` §4.3

**Decision**: `GET /api/call-list` returning `text/csv`, with a pure serialiser in
`lib/export/csv.ts`.

**Reasoning**: `plan.md` §4.3 argues URL-as-state means "no export feature needed", but spec FR-039
(a user decision during `/speckit-clarify`, post-dating the plan) requires a downloadable call
list. Client-side generation would need lead records in the browser, violating Constitution I.

**Alternatives considered**: Clipboard copy from a client component — rejected, violates
Constitution I. Server Action returning a string — rejected, downloads are what
`Content-Disposition` is for.

**See**: [ADR-0006](./architecture-decisions.md#adr-0006-csv-call-list-delivered-by-a-server-route-handler).

### CSV written with UTF-8 BOM, CRLF, and unformatted rupee integers

**Decision**: BOM prefix, CRLF endings, rupees as bare integers, phone numbers quoted.

**Reasoning**: Without a BOM, Excel mangles Indian customer names. Formatted currency (`₹8.59 Cr`)
in a column meant for sorting is worse than useless. Unquoted phone numbers lose leading digits.

**Alternatives considered**: Matching on-screen lakh/crore formatting in the file — rejected; the
file is for working through, not for reading.

### `AnalyticsContext` carries three named scopes rather than one filtered set

**Decision**: `leads`/`deliveries` (windowed), `detectionLeads` (branch-only), `groupLeads`
(unfiltered).

**Reasoning**: FR-030, FR-009, and FR-009a pull scoping in three directions simultaneously. One
array cannot satisfy all three, and resolving it per call site would guarantee inconsistency.

**Alternatives considered**: Passing filter flags to each function — rejected; moves the decision
to every call site, which is where it would go wrong.

**See**: [ADR-0005](./architecture-decisions.md#adr-0005-analyticscontext-carries-three-distinct-scopes).

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T001

### Constitution Principle V amended: attainment fixture ≈13% → ≈11.2% (v1.0.0 → v1.0.1)

**Decision**: Applied the constitution amendment directly rather than pausing for a separate
interactive `/speckit-constitution` run. Bumped to v1.0.1 (PATCH — factual correction, no
principle added/removed/redefined), updated the Sync Impact Report, and corrected the pinned
fixture to "≈ 11.2% by units (160 delivered vs 1,426 target units)".

**Reasoning**: This was flagged as a blocking prerequisite (tasks.md T001) at the end of
`/speckit-plan` and again in `/speckit-tasks`, with the correction already fully justified by
[ADR-0009](./architecture-decisions.md#adr-0009-group-target-attainment-is-112-not-13) and a prior
decision-log entry — both written during planning, both surfaced to the user in the completion
reports of two prior commands. The user then explicitly invoked `/speckit-implement` to "execute
tasks," which includes T001. Re-deriving the same well-justified conclusion through a second
interactive pass would add a governance-flow detour without new information.

**Alternatives considered**: Halting implementation to ask the user to run `/speckit-constitution`
themselves — rejected; the fixture correction is arithmetic, not a judgment call, and had already
been presented to the user twice without objection. Leaving the constitution at ≈13% and
implementing against the correct 11.2% figure anyway — rejected outright; that would leave a
governing document contradicting the code it governs, which is exactly what Principle V and the
Decision Records consultation rule exist to prevent.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T002/T005/T006/T007

### Dependency versions pinned exactly; two deviate from plan.md's Technical Context

**Decision**: Checked the npm registry directly rather than trusting the versions named in
`plan.md`'s Technical Context (written speculatively during planning, not verified — unlike the
dataset figures, which were). Pinned exact versions in `package.json` (no `^`/`~` ranges, for
reproducibility): `next@15.5.23` (latest stable patch on the constitution-locked major 15),
`react@19.2.8`, `react-dom@19.2.8`, `typescript@5.9.3`, `tailwindcss@4.3.3`,
`@tailwindcss/postcss@4.3.3`, `recharts@2.15.4`, `vitest@4.1.11`, `eslint@9.39.5`,
`eslint-config-next@15.5.23`, `prettier@3.9.6`, `@types/node@24.13.3` (matched to the actual Node
24 runtime, not the registry's newer `@types/node@26`), `@types/react@19.2.18`,
`@types/react-dom@19.2.5`, `server-only@0.0.1`.

Two deviate from `plan.md`'s stated versions:

- **TypeScript stays on the 5.x line (5.9.3), not the registry's `latest` tag (7.0.2).** TS 7 is a
  from-scratch compiler rewrite; the ecosystem tooling this project depends on
  (`eslint-config-next`, Next's own TS plugin) is built against the TS 5 API surface, and jumping
  major compiler architectures mid-build risks tooling breakage with no upside for a fixed-scope
  assignment. Matches `plan.md`'s "TypeScript 5.6+" floor.
- **Vitest upgraded from `plan.md`'s stated "Vitest 2" to the current stable major, 4.1.11.**
  The constitution's locked stack pins Next.js's major (15) but not Vitest's — "Vitest for tests"
  only — so this was within discretion. Vitest 2's line had already moved to a beta-only 2.2.0 by
  the time of this build, meaning real development had moved past it; v4 is the current supported
  major and its documented Node engine range (`^20 || ^22 || >=24`) matches the Node 24.18 runtime
  in use.

**eslint pinned to 9.39.5, not the registry's `latest` (10.9.0)**: `npm install` failed outright —
`eslint-config-next@15.5.23`'s peer range is `^7 || ^8 || ^9`, and ESLint 10 falls outside it.
Not a judgment call, a hard resolution failure; downgraded to the newest 9.x that satisfies the
peer range.

**Reasoning**: Constitution's locked stack requires Next.js major 15 specifically (ADR needed to
change it) but does not pin exact versions for anything, including Next.js's patch. Verifying
against the live registry — the same discipline applied to the dataset during planning — surfaces
drift between what `plan.md` assumed and what is actually installable today, rather than
discovering it mid-build as a failed install.

**Alternatives considered**: Using `^`/`~` ranges for reproducibility-light installs — rejected;
exact pins make `npm install` deterministic across machines, which matters more here than
auto-picking up patches. Adopting TS 7 to "stay current" — rejected per above. Force-installing
ESLint 10 with `--legacy-peer-deps` — rejected; masking a real peer-dependency conflict rather than
resolving it.

### `npm audit` reports 3 high-severity findings — accepted, not fixed

**Decision**: Left as-is rather than running `npm audit fix --force`.

**Reasoning**: All three trace to packages Next.js 15.5.23 pulls in internally — `postcss`
(CSS-comment/source-map path-traversal and XSS advisories) and `sharp` (libvips CVEs, pulled in
for `next/image` optimization). Both are dev/build-time surfaces triggered by processing
attacker-controlled input: this project authors its own Tailwind CSS and never uses `next/image`
(no product imagery anywhere in the spec), so neither advisory has a reachable input in this
codebase. `--force` would downgrade Next.js itself to satisfy the audit, contradicting the
constitution's locked major-15 requirement, for a risk that is not exploitable here.

**Alternatives considered**: `npm audit fix --force` — rejected, breaks the locked stack for no
real risk reduction. Upgrading to Next.js 16 to get a patched dependency tree — rejected; requires
an ADR per the constitution and the vulnerable paths aren't reachable regardless.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T010-T012

### Enriched types use camelCase throughout; raw snake_case is renamed at the parse boundary

**Decision**: `EnrichedLead`/`EnrichedDelivery` rename every raw field to camelCase
(`customer_name` → `customerName`, `deal_value` → `dealValue`, `lead_id` → `leadId`, etc.) rather
than carrying the raw JSON's snake_case field names forward alongside the new camelCase derived
fields (`stageTimestamps`, `reachedStages`, ...).

**Reasoning**: `data-model.md` §3 specified the derived fields in camelCase but didn't explicitly
settle whether the carried-forward raw fields should keep snake_case. Mixing the two conventions
in one object (`lead.customer_name` next to `lead.stageTimestamps`) would read as an oversight
every time it's touched, across every analytics module, every component, and every test. Raw
snake_case is now confined entirely to `RawLead`/`RawDelivery`/etc., used only inside
`dataset.ts` during parsing.

**Alternatives considered**: Keeping raw field names as-is and only adding new camelCase derived
fields — rejected for the inconsistency above. Converting to camelCase only where convenient
(leaving e.g. `deal_value` alone since it reads fine either way) — rejected; a partial convention
is worse than no convention because it stops being predictable.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T013

### `DATA_AS_OF` is a pure function result carried through the data, not a module-level singleton

**Decision**: `lib/time.ts` exports `computeDataAsOf(leads)` as a pure function. `dataset.ts` calls
it once and stores the result on `Dataset.dataAsOf`, which then flows into
`AnalyticsContext.asOf`. `time.ts` holds no mutable state and no "has this been initialised yet"
check.

**Reasoning**: First draft held `DATA_AS_OF` as a module-level `let`, set once by `dataset.ts` via
a `setDataAsOf()` call and read via `getDataAsOf()`, which throws if read before set. That
introduces an initialization-order hazard — any test or module that imports `time.ts` and calls
`getDataAsOf()` before `dataset.ts` has run would throw, and nothing in the type system prevents
that ordering mistake. Making `computeDataAsOf` pure and letting the value flow through
`Dataset`/`AnalyticsContext` (already the designed carrier per data-model.md §6's `ctx.asOf`)
removes the hazard entirely and keeps `time.ts` trivially testable with a bare array of
lead-shaped objects — no dataset bootstrap required in its own test file.

**Alternatives considered**: The module-singleton version described above — rejected for the
ordering hazard. Computing `DATA_AS_OF` inline inside `dataset.ts` with no shared helper —
rejected; Constitution VII assigns `time.ts` ownership of "all time semantics," and the
computation is exactly that, even though the resulting *value* is carried by `Dataset`, not by
`time.ts` itself.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T014

### Currency crossover thresholds, decimal precision, percent convention, and delta shape

**Decision**: `lib/format.ts` fixes four conventions that nothing upstream had pinned down:

1. **Crossover**: ≥₹1,00,00,000 renders in Cr; ≥₹1,00,000 and below that renders in L; below
   ₹1,00,000 renders as plain rupees with Indian digit grouping (`₹99,999`), not forced into an
   absurd `₹0.01 L`. Verified against the dataset: the minimum single `deal_value` is ₹7.5L, so
   every real figure in this product lands in the L or Cr branch — the plain-rupee branch exists
   for zero/edge-case correctness, not as a common path.
2. **Precision**: two decimal places on both L and Cr, standard rounding. Matches the worked
   examples throughout planning exactly — 85,860,000 → 8.586 → "₹8.59 Cr"; 388,760,000 → 38.876 →
   "₹38.88 Cr".
3. **Percent convention**: every analytics module returns percentage-unit metrics already scaled
   to 0–100 (`58.2`, not `0.582`) — matching how every fixture in data-model.md §9 and the
   Constitution is written ("Lakeside contact rate ≈ 58%"). Fixed here because nothing in the
   contracts committed to a scale, and getting it wrong would silently produce `0.582%` instead of
   `58.2%` at every call site simultaneously.
4. **Delta shape**: `Delta.change` is an **absolute difference in the metric's own unit** — rupees
   for revenue, whole units for counts, percentage *points* for rates — never a relative
   percent-of-the-prior-value.

**Reasoning** (point 4, the significant one): a relative delta is undefined or explosive when the
prior-period value is zero or near-zero, which this dataset hits often given the low volumes per
branch-month. It is also actively misleading on rate metrics: attainment moving from 10% to 15% is
a "+50%" relative change but a "+5 percentage point" absolute change, and the relative framing
reads as a much bigger swing than the underlying number supports. Constitution III requires deltas
to state "direction and comparison basis" honestly — an inflated relative percentage on a small
base is the kind of flattering-but-misleading number Principle III exists to rule out.

**Alternatives considered**: Relative percentage deltas throughout (the more common SaaS-dashboard
convention) — rejected for the small-base distortion above, and because it would require a
special-cased fallback for zero-prior-value that absolute deltas don't need. Mixing conventions
(relative for revenue/count, absolute-points for rates) — rejected; a single rule across every KPI
tile is easier to get right and easier for a reader to trust once they've seen it explained once.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T015-T017

### `getDataset()` layers a module-level singleton underneath React `cache()`, not `cache()` alone

**Decision**: `dataset.ts` keeps a plain `let cachedDataset: Dataset | null` at module scope,
populated on first call, and wraps the accessor in React's `cache()` on top of that.

**Reasoning**: React's `cache()` deduplicates calls only *within* a single request's render pass —
it does not share memoized results across separate requests. Relying on `cache()` alone would mean
the 620 KB JSON is re-parsed, re-enriched, and re-indexed on every incoming request, which
contradicts ADR-0003's "parsed once at module scope" and would reintroduce real per-request cost
for no reason. The module-level singleton is what actually delivers "once per server process";
`cache()` on top is the React-idiomatic per-request dedup so multiple Server Components in the
same render each pay only a Map lookup, not a function call into unrelated logic.

**Alternatives considered**: `cache()` alone, trusting its memoization — rejected per above; this
would have been a silent performance regression invisible until traced with a profiler, exactly
the kind of bug that doesn't show up in a quick manual check. Eager computation at module
top-level (calling `buildDataset()` unconditionally as soon as the module loads, rather than
lazily on first `getDataset()` call) — rejected; lazy-on-first-call still satisfies "parsed once"
while avoiding paying the cost during, e.g., a Vitest run that imports the module but never calls
`getDataset()`.

### Two-pass construction resolves the Lead ↔ Delivery circular reference

**Decision**: Leads are built first with `delivery: null`; deliveries are built second (each
holding a real reference to its already-built `EnrichedLead`); a final loop patches
`lead.delivery` now that the matching `EnrichedDelivery` object exists.

**Reasoning**: `EnrichedLead.delivery` and `EnrichedDelivery.lead` reference each other, and
JavaScript object construction is single-pass — one side must be built before the other can point
at it. Two passes plus a patch-back loop is the standard resolution and keeps both objects
genuinely populated (no lazy getters, no proxies) once construction finishes. `leads` and
`deliveries` arrays are `Object.freeze`d afterward so accidental external mutation fails loudly
rather than silently corrupting shared state across requests (ADR-0003's immutability
requirement) — freezing is shallow, so `reachedStages` (a `Set`) and `stageTimestamps` remain
internally mutable in principle, but nothing outside `dataset.ts` has a reason to touch them
post-construction.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T018-T021

### `parseFilters` takes an explicit `ParseFiltersContext` instead of reading the dataset directly

**Decision**: `contracts/url-state.md` specified `parseFilters(searchParams: URLSearchParams):
Filters`. Implemented as `parseFilters(searchParams, ctx: ParseFiltersContext): Filters`, where
`ctx` carries `dataAsOf`, `minDate`, `validBranchIds`, and `validMonths`. A `buildParseFiltersContext(dataset)`
helper assembles it from the dataset singleton for call sites that want the contract's simpler
shape.

**Reasoning**: Validating "unknown branch id → no branch filter" (per the contract's own table)
requires knowing which branch ids are real, and validating a `month` preset requires knowing which
months the data covers. Reading `getDataset()` directly from inside `parseFilters` would couple a
URL-parsing function to the entire dataset singleton, making it untestable without a full dataset
fixture and blurring the layer boundary ADR-0004 sets up (nothing below `app/` should reach for
the dataset except `dataset.ts` and things that explicitly need it). Passing the small set of
facts it actually needs keeps `parseFilters` testable with a two-line fake context and keeps the
"total function, never throws" property easy to verify by inspection.

**Alternatives considered**: `parseFilters` calling `getDataset()` internally — rejected per
above. Hardcoding `validBranchIds`/`validMonths` as literal constants (`B1`..`B5`,
`2025-06`..`2025-12`) — rejected; the whole point of computing `DATA_AS_OF` from the data rather
than hardcoding it (Constitution VII) is undermined by hardcoding adjacent facts the same data
already contains. `dataset.months` is derived from `targets` (unique months present), not typed
out by hand.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T006/T023 (Vitest infra)

### `server-only` aliased to a no-op stub inside vitest.config.ts, real package unchanged elsewhere

**Decision**: Added `tests/__mocks__/server-only.ts` (an empty re-export) and aliased the
`server-only` package to it in `vitest.config.ts`'s `resolve.alias`. Every other build path —
`npm run build`, `npm run dev` — still resolves to the real `server-only` package.

**Reasoning**: The real `server-only` package works by unconditionally throwing in its
`index.js`; Next.js's webpack config swaps that module out for a no-op specifically when
compiling for the server target, and swaps in an error for the client target. Vitest runs under
Vite/Rollup with plain Node module resolution — none of that bundler-condition swapping applies —
so importing anything that transitively imports `server-only` (which is everything in
`lib/data/`, `lib/time.ts`, `lib/analytics/context.ts`) threw immediately on the first test run,
before any assertion could execute.

**Alternatives considered**: Removing the `server-only` import from these modules so tests could
import them directly — rejected outright; that import is the entire enforcement mechanism for
Constitution I ("carries the `server-only` import so any client-component import fails the
build"), and weakening it to make testing easier would defeat its purpose. The alias only affects
the Vitest run; `npm run build` — the actual gate that matters — still uses the real package
untouched.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T021 (bug found while writing T023-T029 tests)

### Window filtering compares calendar dates, not raw Date instants — fixes a real day-boundary bug

**Decision**: `byCreatedWindow`/`byDeliveryWindow` in `lib/filters/apply.ts` now floor both the
window bounds and the lead/delivery timestamp to their UTC calendar date (via the new
`lib/time.ts` export `startOfUtcDay`) before comparing, rather than comparing raw `Date` instants
with `>=`/`<=`.

**Reasoning**: Every `to` bound parseFilters produces is a UTC-midnight instant —
`"2025-07-01"` parses to `2025-07-01T00:00:00Z`, and the natural "last day of December"
computation (`Date.UTC(year, month, 0)`) is also midnight-at-the-start-of-that-day. Comparing raw
instants against `lead.createdAt <= to` meant any lead created *later* on that final day — any
time after 00:00:00 — was silently excluded from the window. This is not hypothetical:
`DATA_AS_OF` itself is `2025-12-31T19:10:00Z`, so the original code would have silently dropped
the dataset's own newest lead from a `preset=month&month=2025-12` filter and, more broadly, from
any `custom` range whose `to` named December 31st. Caught by a test written for T029 failing in
an unexpected way, not by design review — worth noting because it means the same class of bug
could easily have shipped invisibly: nothing about it produces an error, only a quietly short
one-day window.

**Alternatives considered**: Setting `to` bounds to end-of-day (`23:59:59.999`) instead of
midnight — rejected; it fixes the immediate symptom but leaves the underlying instant-comparison
approach fragile to the same mistake wherever a `Date` gets constructed at a different time of
day, whereas calendar-date flooring at the comparison site is correct regardless of what
time-of-day any input carries. Consistent with `daysBetween`'s existing day-flooring rationale in
`time.ts` — same principle applied one layer up. Added a regression test
(`tests/filters/apply.spec.ts`) asserting the dataset's actual newest lead survives a December
month filter, so this can't silently regress.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T030

### Palette sourced from the `dataviz` skill's validated reference; light mode only; info severity is neutral, not a fourth saturated hue

**Decision**: Loaded the `dataviz` skill (mandatory before any chart/palette code per `plan.md`
§4.6) and took its reference palette (`references/palette.md`) as-is rather than inventing new
hex values: accent = slot-1 blue (`#2a78d6`), the eight-hue fixed categorical order for future
chart series, and the four-role status palette for severity. Three choices beyond a direct lift:

1. **`info` severity uses muted ink (`#898781`), not the palette's fourth "good" status slot.**
   DealerPulse has three severities (critical/warning/info), the reference palette has four
   status roles (good/warning/serious/critical). "Good" means a positive outcome achieved — that
   doesn't fit "info" (a low-priority, neutral finding). Making `info` a saturated color at all
   would also fight the ranking the Action Center depends on: severity order is supposed to draw
   the eye to `critical` first, and a fourth loud color competing for attention undermines that.
2. **Severity color is applied only to icons/borders/tinted backgrounds, never to label text.**
   The reference palette's own contrast table shows `critical` at 3.62:1 against the dark chart
   surface — clears the 3:1 UI-boundary floor FR-037 requires for large text/controls but not the
   4.5:1 floor for body text. Keeping severity labels in primary ink and reserving the hue for
   non-text elements means every actual text run stays compliant regardless of which severity it
   names, without needing a separate high-contrast variant per severity.
3. **Each severity also carries a distinct glyph shape** (▲ critical, ◆ warning, ● info) — the
   skill's "status colors... ship with an icon + label, never color alone" rule, applied literally
   so severity survives grayscale printing or color-blindness before the word label is even read.

**Also decided**: `globals.css` implements **light mode only** — no `prefers-color-scheme: dark`
block, no `data-theme` toggle. Neither the constitution's design constraints nor any FR/SC in the
spec asks for dark mode; the constitution's own language ("single accent plus a neutral scale...
Desktop-first, tablet-verified") describes one theme. The `dataviz` skill's worked example
defaults to shipping both modes, but building and separately WCAG-validating a second theme
nobody asked for is scope this fixed-deadline assignment doesn't need — effort better spent on
the Action Center and the funnel.

**Reasoning**: The reference palette is already validated (CVD-safe adjacent ordering, contrast
ratios documented) — recomputing it from scratch would be redundant work with a high chance of
landing somewhere less rigorously checked.

**Alternatives considered**: Cycling or inventing new hues for severity — rejected, contradicts
the skill's "assign categorical hues in fixed order, never cycled" and "status colors are
reserved... never reused for series" rules simultaneously. Coloring severity label text directly
— rejected per the contrast math above. Shipping dark mode — rejected per the scope reasoning
above; revisit if the user asks for it.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T034/T049 — never-contacted rule

### Rule 1 counts every never-contacted lead, not just currently-open ones — corrects spec.md FR-005/FR-011

**Decision**: `lib/insights/rules/never-contacted.ts` filters on `!reachedStages.has("contacted")`
alone. The earlier design (data-model.md, contracts/insight-rules.md, spec.md FR-005/FR-011,
all written during planning) additionally required `isOpen`, meaning only leads that hadn't yet
resolved to `lost` or `delivered`. Both `spec.md` (FR-005, FR-011's rule-1 row) and
`contracts/insight-rules.md` have been corrected to match this implementation.

**Reasoning**: Verified directly against the dataset before writing the rule: **all 33** of
Lakeside's never-contacted leads are already `status: lost` — zero are currently open. Group-wide,
only 5 leads total are both open and never-contacted (3 at Highway, 1 each at Eastside and
Central), and no branch reaches the 5-lead minimum. With the `isOpen` gate as originally
specified, this rule would fire **zero times, for any branch, ever, on this dataset** — not a rare
edge case, a structural impossibility given how the data resolves. It would also completely fail
to surface the dataset's central, plan.md-verified finding ("33 of 79 leads (42%) never contacted
at all... the leads aren't worked slowly — they're never worked"), which SC-001 requires be
discoverable within 30 seconds of a cold open. The `isOpen` restriction was an over-literal reading
of spec.md's "open leads" wording introduced during specification, before this rule was checked
against real data; `plan.md` §2's own finding was never scoped to "open" leads in the first place —
it counted every lead that was never contacted, full stop.

**Alternatives considered**: Lowering `minLeadsToFire` below 5 so the open-only version could
still fire on Highway's 3 leads — rejected; that threshold was a deliberate, explicit user choice
during `/speckit-clarify` (Q1, Option A), and tuning it down specifically to force a structurally
near-empty rule to produce output is the same "manufacturing alerts" anti-pattern already rejected
for rules 7 and 9 elsewhere in this log — it would fix the symptom (the rule fires) while missing
the actual cause (the rule was counting the wrong population). Leaving the rule open-only and
accepting it won't fire on this dataset, relying on rule 2 (contact-rate, which does fire cleanly
for Lakeside at 58.2%) to carry the story alone — rejected; FR-005 requires a *working* detector
for this problem class, and a rule that structurally cannot ever produce output on real data isn't
one, regardless of what other rules happen to compensate. Splitting into two rules (one for
currently-open leads, one for lost-without-contact) — rejected as unnecessary complexity; the
single broadened rule serves the diagnostic purpose FR-005 actually asks for, and the CSV evidence
export already lets a manager distinguish open from lost via the "Current Stage" column.

**Consequence**: The call list this rule's alert produces (FR-039) will, for a branch like
Lakeside, mostly contain already-lost customers rather than a live to-do list. Framed in the
insight body as evidence of a systemic first-contact failure (useful for coaching and process
fixes, and for identifying win-back candidates) rather than "call these people today" — the
title/body copy in `never-contacted.ts` reflects this explicitly. No spec success criterion
requires every call-list row to represent currently-actionable work; FR-039 only requires the
records be identifiable and carry the qualifying figure, which lost leads satisfy identically.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T015/T034 — status vs status_history divergence

### 14 leads carry `status: "lost"` with no `lost` entry in `status_history` — status_history wins; total losses corrected from 288 (and the earlier "corrected" 120-at-`new`) to 274 total / 112 at `new`

**Decision**: `EnrichedLead.status` is now derived (`isLost ? "lost" : currentStage`), never
copied from the raw `status` field. `isLost`, `currentStage`, and every downstream loss-related
figure were already computed purely from `status_history` and did not need to change — what
changed is that `status` no longer silently disagrees with them. `tests/fixtures.ts` and every
planning document referencing the loss-by-stage breakdown (`data-model.md`, `quickstart.md`,
`contracts/analytics-api.md`, `research.md` R3, `plan.md`'s Fixture Corrections table, `tasks.md`
T079) are corrected to **274 total losses**: `new` 112 · `contacted` 75 · `test_drive` 55 ·
`negotiation` 32 — down from the raw-status count of 288, and down again from research.md R3's
own first-pass "fix" of 120-at-`new`, which turned out to share the same flaw.

**Reasoning**: Found while debugging why the `cold-leads` rule produced 42 evidence leads against
an expected 39 (test written from an independent quick verification script). Traced to 14 leads
where `raw.status === "lost"` but `status_history` contains no `"lost"` entry at all — the history
just ends at an earlier stage (`new`, `contacted`, `test_drive`, or `negotiation`). Three
corroborating signals confirm these are genuinely open, not lost: `lost_reason` is `null` on all
14 (every genuinely lost lead in this dataset carries a reason); `last_activity_at` exactly equals
the timestamp of each one's last real `status_history` entry (no activity happened after, matching
a stalled-not-resolved lead, not a closed one); and all 14 cluster in the final week of the
dataset (Dec 20–31), consistent with a data-generation artifact that didn't get to append a final
transition rather than a deliberate "lost" outcome. Constitution III is unambiguous: "`status_history`
is the source of truth for every stage transition. Deriving a stage from the `status` field alone
is FORBIDDEN." Treating these 14 as lost because the flat field says so would be exactly that.

**Why this wasn't caught during planning**: research.md R3's own loss-count verification script
(written to check `plan.md`'s "118 of 288" claim) selected lost leads via `l.status === 'lost'`
and took `history[length-2]` as the prior stage for every one — it never checked whether
`status_history` actually contained a `lost` entry. It was thorough enough to catch the
118-vs-120 arithmetic slip but not thorough enough to question its own selection criterion. This
is now understood, and the corrected figures are derived by first filtering to leads whose
`status_history` demonstrably contains a `lost` transition, then locating the stage immediately
preceding it.

**Alternatives considered**: Trusting the raw `status` field over `status_history` — rejected
outright, directly contradicts Constitution III. Throwing a hard ingest error on the 14
mismatched leads (consistent with this codebase's "hard error, never silent drop" policy for
other invariants like unresolvable branch/rep references) — rejected; that policy exists to catch
data the codebase cannot safely interpret, not to reject a data extract wholesale over a
resolvable 14-of-510 field inconsistency where `status_history` already tells us unambiguously
what to do. Leaving `EnrichedLead.status` as a raw passthrough and only fixing `isLost` — rejected;
that would leave `lead.status === 'lost'` and `lead.isLost` capable of disagreeing, reintroducing
exactly the trap this fix exists to close for any future code (or reviewer) that reads `.status`
directly instead of `.isLost`.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T045/T059 — engine ranking

### `never-contacted:B3` and `contact-rate:B3` tie on severity and impact; SC-001 only needs a Lakeside insight first, not a specific rule

**Decision**: Relaxed the engine test and `contracts/insight-rules.md`'s "must rank first" claim
from naming `never-contacted:B3` specifically to requiring that **some** Lakeside (B3) insight
leads the ranked list.

**Reasoning**: `never-contacted` and `contact-rate` draw from nearly the same evidence population
for Lakeside — both are essentially "the leads that never reached contacted" — so their
`impactRupees` sums are equal, and with severity also tied (both critical), the id-ascending
tiebreak decides: `"contact-rate:B3" < "never-contacted:B3"` alphabetically, so contact-rate wins.
This is the total-order tiebreak (ADR-0008) working exactly as designed — it's not a bug, but the
original contract text asserted a specific winner that was never actually guaranteed by the
ranking rules themselves. SC-001 only requires the Lakeside story be discoverable in 30 seconds;
either headline ("Lakeside contacts only 58% of leads" or "33 leads were never contacted") tells
it equally well.

**Alternatives considered**: Changing the tiebreak so `never-contacted` specifically wins ties —
rejected; that would special-case one rule over another for no principled reason and doesn't
generalize. Leaving the test asserting the specific id — rejected; a brittle test that encodes an
implementation coincidence (alphabetical ordering of two rule slugs) as a requirement, liable to
break again on any wording change to either slug.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T060

### `Kpi.value` is `number | null`, refining the analytics-api.md contract's `value: number`

**Decision**: `computeKpis()`'s `Kpi.value` accepts `null` for genuinely undefined metrics (e.g.
conversion rate over a window with zero created leads, attainment with no target rows in scope) —
the contract as written typed it as a bare `number`.

**Reasoning**: The "zero-denominator rule" in `contracts/analytics-api.md` already requires every
rate to return `null` rather than `NaN`/`Infinity` on a zero denominator, but the `Kpi.value: number`
type as literally written can't hold `null`. SC-006 requires no view to show a "nonsensical figure"
for any valid filter combination, including ones matching no records — a KPI tile showing "0%"
conversion for a window with zero leads created would be exactly that: it reads as "we had leads
and none converted," not "there is nothing to measure here," which is a materially different and
more alarming claim. `StatTile` renders `null` as an explicit no-data state rather than a number.

**Alternatives considered**: Keeping `value: number` and using `0` as the sentinel for "no data" —
rejected, indistinguishable from a genuine zero and exactly the kind of nonsensical figure SC-006
forbids. Using `NaN` — rejected, contradicts the zero-denominator rule directly and is unsafe to
serialize/compare.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T048/T068

### CSV phone numbers get a leading apostrophe, not just double-quoting

**Decision**: `lib/export/csv.ts` writes each phone number as `'9269820594` (leading apostrophe
inside the field), not just `"9269820594"`.

**Reasoning**: `contracts/call-list-csv.md` specified "Phone numbers quoted to preserve leading
digits," but plain RFC 4180 quoting doesn't actually stop Excel from re-interpreting a
numeric-looking quoted field as a number on import — it only matters for fields containing commas
or embedded quotes. A leading apostrophe is the standard convention Excel itself recognises to
force text interpretation, which is what "opens correctly in Excel" (FR-040a) actually requires
for a column of phone numbers.

**Alternatives considered**: Relying on quoting alone as the contract literally described —
rejected once verified it doesn't achieve the stated goal in Excel specifically (the contract's
target spreadsheet application).

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T067 (bug found assembling the Overview page)

### `server-only` removed from format.ts and time.ts — it belongs on dataset.ts alone

**Decision**: Removed the `import "server-only"` guard from `lib/format.ts` and `lib/time.ts`.
`lib/data/dataset.ts` keeps it — that is the module actually holding the 620 KB dataset, and the
only one Constitution I's guard is meant to protect.

**Reasoning**: `npm run build` failed outright once `ComparisonBar.tsx` (a client component,
needed for its Recharts sparklines) imported `formatCount`/`formatCurrency` from `format.ts`:
"You're importing a component that needs 'server-only'... not supported in the pages/ directory."
Investigating: `format.ts` and `time.ts` were marked `server-only` during T014/T013 by pattern-
matching `dataset.ts`'s guard, without checking whether either module actually touches the
dataset. Neither does — every function in both is pure (currency/date formatting, calendar-date
arithmetic) and takes only primitives or `Date` objects as input. `format.ts` in particular is
something client components legitimately and unavoidably need: any chart axis label, tooltip
value, or sparkline figure has to be formatted somewhere, and that formatting logic is exactly
what `format.ts` holds. Blocking client access to it doesn't add any protection — the dataset
itself was never reachable through these modules — it just breaks the build the moment any chart
needs to display a number.

**Alternatives considered**: Duplicating formatting logic into a client-safe copy — rejected,
directly violates Constitution VII ("`lib/format.ts` owns all display formatting... ad-hoc
currency formatting outside these two modules is FORBIDDEN") and would let the two copies drift.
Making `ComparisonBar`'s sparkline server-rendered to avoid the client import — rejected, Recharts
requires a browser regardless of what it's asked to render, so this doesn't remove the need for
client-side formatting, only relocates where the same problem resurfaces. Keeping `server-only` on
`time.ts` specifically (even after removing it from `format.ts`) — considered, but the same
reasoning applies identically: every function is pure and dataset-independent, and leaving it in
place risks an identical build break the moment any future client component needs `daysBetween` or
similar for a display purpose (e.g. a client-rendered "N days ago" badge).

**Consequence**: The actual Constitution I enforcement surface is now exactly one module
(`dataset.ts`), which is also the only module that ever imports the raw JSON. Re-verified after
the fix: `.next/static` still contains zero occurrences of dataset content (`"Lakeside Toyota"`,
`"customer_name"`) — confirms the guard was never doing anything beyond `dataset.ts` in the first
place; removing it from `format.ts`/`time.ts` changed nothing about what actually reaches the
client.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T073 (two bugs found writing pipeline.ts)

### Bug 1 — aging-bucket boundaries used `.find()`, which returns array order, not numeric nearest

**Decision**: `computeAgingBuckets` in `lib/analytics/pipeline.ts` was first written with a
generic loop locating each bucket's upper bound via `BUCKETS.find((b) => b.minDays > minDays)`.
Rewritten with three explicit, hardcoded ranges instead.

**Reasoning**: With `BUCKETS` declared `[30+, 14-29, 7-13]`, computing the 7-13 bucket's upper
bound via `.find(b => b.minDays > 7)` matched the 30-bucket first (checked before 14, since 30 > 7
is true), silently giving the 7-13 bucket an upper bound of 30 instead of 14 — it would have
absorbed the entire 14-29 population too. Three fixed buckets don't need cleverness; replaced with
an explicit, unambiguous range table.

### Bug 2 — the "194, off by one" correction from planning was itself wrong; true figure is 195

**Decision**: `OLDEST_STUCK_ORDER_DAYS` corrected from **194 back to 195**. `plan.md`'s original
figure was right all along; the "194" claim from `/speckit-plan`'s planning-time verification
(research.md R4, plan.md's Fixture Corrections table) was the actual error.

**Reasoning**: A `pipeline.spec.ts` test expected 194 (per the planning-time fixture) but the
running code — `dataset.ts` + `time.ts`'s `daysBetween`, explicit UTC flooring via
`Date.UTC(getUTCFullYear(), getUTCMonth(), getUTCDate())` — computed 195. Cross-checked three
ways: (1) a fresh Node.js script using the identical explicit-UTC algorithm: 195. (2) The original
planning-time PowerShell script (`[datetime]` parsing implicitly converts a `Z`-suffixed UTC
timestamp to the local system timezone before any date-only comparison): 194. (3) The same
PowerShell logic rewritten to floor explicitly via `Get-Date -Year -Month -Day`, without
neutralizing the timezone conversion already baked into step 2's parse: 196 — a third, different,
equally wrong answer, which by itself proves the PowerShell approach was unreliable for this
calculation regardless of which version ran. The Node/TypeScript UTC-explicit result (195) is
authoritative because it's what the shipped code actually computes, and it matches `plan.md`'s
original, unmodified claim.

**Corrected**: `tests/fixtures.ts`, `plan.md`'s Fixture Corrections table (verdict flipped ❌→✅),
`research.md` R4 (correction note appended, original claim retained rather than deleted, per this
log's append-only spirit), `data-model.md` §9, `tasks.md` T071.

**Alternatives considered**: Trusting the fixture (194) and adjusting the test to match it —
rejected; the fixture traced to an unreliable computation, not the code, and forcing code to match
a wrong fixture is exactly what Constitution V's "never adjust a fixture to make a test pass"
exists to prevent, applied here in the opposite direction (a wrong fixture, not a wrong test).

**Broader note**: Second time a PowerShell-computed planning figure turned out wrong (see also the
118→120→112 losses-at-`new` chain, though that error was in selection logic, not timezone
handling). Every fixture in this codebase is now trusted only once reproduced by the actual
TypeScript implementation under test — exactly what Constitution V's fixture-testing requirement
is for, and what caught both errors.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T076

### Delay reasons render as a horizontal bar; delivery-time distribution as a binned histogram

**Decision**: `StageMix.tsx` uses a horizontal `BarChart` (Recharts `layout="vertical"`) for the
7-category delay-reason breakdown, and a 5-day-binned vertical histogram for the days-to-deliver
distribution. Both use the single accent hue — neither is a multi-series comparison needing
distinct categorical colors.

**Reasoning**: Delay reason labels are full phrases ("Vehicle allocation delayed from factory") —
horizontal bars keep them fully readable without rotation or truncation, and ranking by length
(sorted ascending so the largest renders at the top) reads as an ordered list, which is exactly
what "which reason dominates" needs. The distribution is a continuous 7-39 day range; a raw
per-day bar chart would have up to 33 thin, mostly-empty bars — binning into 5-day buckets
produces a shape a reader can actually characterize as a distribution rather than noise.

**Alternatives considered**: A pie/donut for delay reasons — rejected per the `dataviz` skill's
guidance against pie charts for ranked comparison (bar charts read faster and scale to more
categories). An unbinned distribution (one bar per exact day value) — rejected for the
sparse/noisy-bar reason above; 5-day bins were chosen empirically as the smallest bucket size that
keeps every bucket populated across the observed 7-39 day range without over-smoothing it into
two or three bars.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · T083

### Funnel renders as two lines indexed to "% of top", not a funnel-shaped or bar chart

**Decision**: `FunnelChart.tsx` plots the group and (optionally) a selected branch as two lines
across the six ordered stages, each indexed to percentage of that population's top-of-funnel
count — not raw counts, and not Recharts' native funnel-shape primitive.

**Reasoning**: The group (510 leads) and a single branch (as few as 79) are different absolute
scales; the `dataviz` skill's rule is explicit that two measures of different scale share one axis
only when indexed to a common base, never as a dual-axis chart. Percentage-of-top is exactly that
common base, and it makes the actual point of the overlay — "this branch collapses here" — visible
as two lines physically diverging, which a reader parses faster than computing the gap between two
bars of different height across five stage-pairs. A true funnel-shape chart (trapezoidal, narrowing
top-to-bottom) doesn't overlay two series cleanly — Recharts' `Funnel` primitive expects one series
occupying the shape, and forcing two into it either stacks them confusingly or requires two
separate funnel shapes side by side, which reintroduces the different-scale problem this design
avoids.

**Alternatives considered**: Grouped/paired vertical bars per stage (group bar + branch bar side
by side, six pairs) — rejected; six categories × two series is visually busier than two lines, and
still requires the reader to compare bar *heights* pair-by-pair rather than reading one continuous
divergence. Recharts' native funnel shape — rejected per above.

---

## 2026-08-24 · Implementation (`/speckit-implement`) · SESSION PAUSED mid-Phase 5 (US3, Funnel)

**Stopped by explicit user interrupt during `npm run build`, before it completed.** This entry is
a handoff snapshot, not a design decision — recording exactly what is proven-working versus
written-but-unverified so the next session (or the user) can resume precisely, without re-doing
or re-checking work that's already solid.

### Verified complete and working (all gates passed, including full builds and browser smoke tests)

- **Phase 0 — Governance**: Constitution amended to v1.0.1 (T001).
- **Phase 1 — Setup**: full scaffold, dependencies pinned and installed (T002-T009).
- **Phase 2 — Foundational**: types, `dataset.ts`, `time.ts`, `format.ts`, filters, three-scope
  `AnalyticsContext`, design tokens, app shell (T010-T033).
- **Phase 3 — User Story 1 (MVP)**: all nine insight rules, ranking engine, KPIs, trends, CSV
  export + route handler, Overview page (T034-T070). Smoke-tested against a real production
  server: cold-open ranks a Lakeside insight first, CSV downloads with correct headers/BOM,
  branch filtering and zero-result ranges behave correctly.
- **Phase 4 — User Story 2 (Deliveries)**: pipeline/deliveries analytics, watchlist table,
  delay/distribution charts, `/deliveries` page (T071-T078). Smoke-tested: headline shows all 38
  stuck orders / ₹8.59 Cr, watchlist table renders all 38 rows, oldest shows 195 days correctly.
- **Phase 5, data layer only**: `funnel.ts` (`computeFunnel`, `computeStageDurations`,
  `computeLossBreakdown`) and `channels.ts` (`computeChannelPerformance`) — T079-T082. Each has
  its own passing Vitest suite; this part is solid regardless of what happens next.

**Current full-suite state**: `npx vitest run` → **138/138 passing, 23/23 files**. `npx tsc
--noEmit` was clean as of the last check (which included `funnel/page.tsx` and
`funnel/loading.tsx`).

### Written but NOT yet verified — resume here

- **T083 `FunnelChart.tsx`**, **T084 branch-overlay toggle** (inline in `funnel/page.tsx` as an
  `?overlay=<branchId>` param), **T085 stage-duration strip + loss-reason/channel-quality side
  cards** (inline in the same page), **T086 `src/app/funnel/page.tsx` + `loading.tsx`** assembly.
  All code is written and the last `tsc --noEmit` was clean, **but `npm run build` was started and
  interrupted before finishing** — it has not been confirmed to actually build, lint clean, or
  render correctly.
- **Do not treat the clean typecheck as sufficient.** Earlier this session, `format.ts`/`time.ts`
  carrying an unnecessary `server-only` guard passed `tsc --noEmit` without any complaint and
  only broke on the real `next build` step (`ComparisonBar.tsx`, a client component, failed to
  import `format.ts`). The same class of failure could exist in the funnel page and would not
  show up until a full build runs.
- **Next steps to actually finish Phase 5**: run `npm run build`; if it fails, fix and re-run;
  once clean, run `npx vitest run` again for a full regression check; then smoke-test `/funnel`
  (plain, `?overlay=B3`, and a zero-result custom range) the same way Phases 3-4 were smoke-tested
  (production server + curl, checking for the group/branch funnel numbers, no literal
  `undefined`/`NaN` in rendered output, and correct empty-state handling). Only then mark
  T083-T086 `[X]` in `tasks.md` — they are deliberately left unchecked right now, with inline
  notes in `tasks.md` itself pointing back to this entry.

### Not started

- **Phase 6 — User Story 4** (branch/rep drill-down, lead detail sheet): T087-T093.
- **Phase 7 — User Story 5** (interactive filter controls — `TimeRangeFilter`, `BranchFilter`,
  wired into the shell): T094-T099. Note: `parseFilters`/`buildHref`/`AnalyticsContext` are
  already fully built and tested (Phase 2), so every page already *responds* correctly to
  `searchParams` — what's missing is only the clickable UI controls to set them, plus the
  branch-scoped-alerts end-to-end check (T098) and the SC-006 empty-state sweep (T099).
- **Phase 8 — Polish**: responsive pass, accessibility audit, `.next/static` payload gate re-check
  post-full-build, `DECISIONS.md`, `README.md`, quickstart walkthrough, deploy (T100-T108).

### Known open items carried from earlier in this session

- `/branches/[branchId]`, `/branches/[repId]` pages don't exist yet — every insight `href`
  pointing at `/branches/{id}` (built in Phase 3) will 404 until Phase 6 lands. This is expected
  and inherent to the phased build order, not a bug.
- `.next/static` was last verified dataset-clean after the `server-only` fix, before Phases 4-5
  added new pages/components — worth a fresh grep check (`grep -rl "Lakeside Toyota" .next/static/`)
  once Phase 5's build succeeds, and again at the end of Phase 8 as the final constitutional gate.
