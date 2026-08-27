# Architecture Decision Records

Formal ADRs for decisions affecting system structure — data model, service boundaries, API
contracts, infrastructure. One ADR per structural decision; routine implementation choices belong
in [decision-log.md](./decision-log.md) instead.

Format: Title · Status · Context · Decision · Consequences. Numbered sequentially.

**Index**

| ADR | Title | Status |
|---|---|---|
| [0001](#adr-0001-application-root-is-the-spec-kit-directory-not-the-git-root) | Application root is the Spec Kit directory, not the git root | Accepted |
| [0002](#adr-0002-single-nextjs-application-with-no-backend-tier) | Single Next.js application with no backend tier | Accepted |
| [0003](#adr-0003-dataset-parsed-and-indexed-once-at-module-scope) | Dataset parsed and indexed once at module scope | Accepted |
| [0004](#adr-0004-three-layer-separation-data--analytics--insights) | Three-layer separation: data → analytics → insights | Accepted |
| [0005](#adr-0005-analyticscontext-carries-three-distinct-scopes) | AnalyticsContext carries three distinct scopes | Accepted |
| [0006](#adr-0006-csv-call-list-delivered-by-a-server-route-handler) | CSV call list delivered by a server route handler | Accepted |
| [0007](#adr-0007-url-is-the-sole-filter-state-store) | URL is the sole filter-state store | Accepted |
| [0008](#adr-0008-insight-identity-is-ruleentity-with-a-total-ordering) | Insight identity is `rule:entity` with a total ordering | Accepted |
| [0009](#adr-0009-group-target-attainment-is-112-not-13) | Group target attainment is 11.2%, not 13% | Accepted |
| [0010](#adr-0010-repository-flattened-application-moved-to-the-git-root) | Repository flattened: application moved to the git root | Accepted |

---

## ADR-0001: Application root is the Spec Kit directory, not the git root

**Status**: Superseded by [ADR-0010](#adr-0010-repository-flattened-application-moved-to-the-git-root) — 2026-08-24

### Context

The repository has an unusual nested layout. The git root is `C:\Projects\Assignment`, holding
`docs/ASSIGNMENT.md`, `docs/dealership_data.json`, and the source `plan.md`. Spec Kit was
initialised one level down in `C:\Projects\Assignment\Assignment`, which holds `.specify/`,
`.claude/`, `specs/`, and is the active working directory.

The source `plan.md` §4 shows a tree with `DECISIONS.md`, `README.md`, `src/`, and `docs/` all at
one root, implying the git root. But `/speckit-implement` runs in the Spec Kit directory, and every
path in the Constitution is written relative to it.

### Decision

The application root is `C:\Projects\Assignment\Assignment` — the Spec Kit directory. `src/`,
`docs/decisions/`, `DECISIONS.md`, `README.md`, `package.json`, and `tests/` all live there. The
dataset is copied to `src/data/dealership_data.json`; `../docs/dealership_data.json` remains
untouched as the original.

### Consequences

- Everything the build touches sits inside the working directory. No tool needs to reach across a
  parent boundary.
- Every path in the Constitution stays accurate as written.
- **Vercel's project Root Directory must be set to `Assignment`**, because the git root is the
  parent. This is a required deploy-time configuration, not an optional one — without it the build
  cannot find `package.json`. Recorded here so it is not discovered during the deploy.
- `docs/` exists in two places with different contents: `../docs/` holds the brief and the original
  dataset, `./docs/` holds the decision records. Slightly awkward; accepted as the lesser cost.
- Rejected: application at the git root with Spec Kit left nested — splits the project across a
  boundary and invalidates Constitution paths. Rejected: re-initialising Spec Kit at the git root —
  disruptive to already-approved artifacts.
- Reversible cheaply before implementation starts; expensive afterwards.

---

## ADR-0002: Single Next.js application with no backend tier

**Status**: Accepted — 2026-08-24

### Context

The product presents analytics over a fixed 620 KB JSON extract. Conventional dashboard
architecture would put a database behind an API and a client app in front. The Constitution locks
the stack to Next.js 15 App Router with "no database, no ORM, no auth, no API layer".

### Decision

One Next.js application. Pages are React Server Components that read filters from `searchParams`,
run analytics in-process, and pass small view-shaped objects to client components. No separate
backend, no database, no ORM, no `/api` surface except the single CSV route handler (ADR-0006).

### Consequences

- No network hop, no serialisation boundary, no cache-invalidation problem between tiers.
- No horizontal scaling story — but the data is 620 KB and read-only, so there is nothing to scale.
- Analytics functions are ordinary pure functions, testable without a server (enables ADR-0004).
- Adding real persistence later would require an ADR superseding this one; it is not a small change.
- Locks deployment to a Node runtime, not Edge — the module-scope singleton needs a warm process.

---

## ADR-0003: Dataset parsed and indexed once at module scope

**Status**: Accepted — 2026-08-24

### Context

Every request needs the full dataset: 510 leads joined to deliveries, grouped by branch and rep,
with derived stage timestamps and ages. Parsing and enriching per request would repeat identical
work. The dataset never changes at runtime.

### Decision

`lib/data/dataset.ts` parses, enriches, and indexes once at module scope, memoises the result, and
exposes it through `getDataset()` wrapped in React `cache()` for per-request identity. Indexes:
`leadById`, `leadsByBranch`, `leadsByRep`, `deliveryByLeadId`, `targetsByBranchMonth`, `repById`,
`branchById`. The module carries a `server-only` import.

### Consequences

- One parse per server process. Per-request cost is a few passes over 510 leads.
- The singleton is **shared mutable state in principle**, so every consumer must treat its arrays as
  immutable and copy before sorting. An in-place sort would make output depend on request order and
  silently break FR-010 determinism. This is the main risk the decision introduces and must be
  enforced in review.
- The `server-only` import turns a Constitution I violation into a build failure rather than a
  silent 620 KB client bundle.
- Cold start pays the full parse. Irrelevant at this size.

---

## ADR-0004: Three-layer separation — data → analytics → insights

**Status**: Accepted — 2026-08-24

### Context

Constitution V requires the analytics and insight layers to be tested against real dataset
fixtures, with no DOM tests. That is only achievable if computation is fully separable from
rendering. The product also has to guarantee that identical inputs produce identical insights
(FR-010).

### Decision

Three layers with a one-directional dependency:

1. **data** (`lib/data/`) — parse, enrich, index. Knows nothing about filters or views.
2. **analytics** (`lib/analytics/`) — pure aggregations. Every function takes `AnalyticsContext`
   and returns a plain serialisable object.
3. **insights** (`lib/insights/`) — pure rules over the same context, plus a ranking engine.

Nothing in `lib/` imports from `app/` or `components/`. No module below `app/` reads
`searchParams`; no module except `lib/time.ts` reads a clock; no module except `lib/format.ts`
formats currency.

### Consequences

- The entire computational core is testable by constructing one context object — no server, no
  request, no DOM.
- Purity makes FR-010 determinism structural rather than something to remember.
- Some indirection: a component that needs one number still goes through the context.
- The clock and currency restrictions are conventions a linter cannot fully enforce; they need
  review attention.

---

## ADR-0005: AnalyticsContext carries three distinct scopes

**Status**: Accepted — 2026-08-24

### Context

The spec pulls filter scoping in three directions at once. FR-030: lead counts filter on
`created_at`, revenue on `delivery_date`. FR-009: alerts ignore the selected time range entirely.
FR-009a: alerts *do* respect the branch filter. FR-009a also requires comparative alerts to keep
showing the group figure they are measured against, even inside a narrowed view.

A single "filtered leads" array cannot satisfy these simultaneously. Handling it ad hoc at each
call site would guarantee inconsistency.

### Decision

`AnalyticsContext` exposes three explicitly named scopes:

- `leads` / `deliveries` — window-scoped, respecting time range and branch. Different date fields
  per FR-030.
- `detectionLeads` — branch filter applied, time range **not** applied. Insight rules only.
- `groupLeads` / `groupDeliveries` — never filtered. Comparison baselines.

Plus `priorLeads` / `priorDeliveries` and `hasPriorPeriod` for period-over-period deltas.

### Consequences

- The distinction is visible in every function signature instead of living in someone's head. This
  is the single most likely correctness bug in the build, and the type system now carries it.
- Slightly larger context object; irrelevant at this data size.
- Rules must be reviewed for reading the *right* scope — reading `leads` instead of
  `detectionLeads` in a rule would reintroduce exactly the bug this prevents.
- `hasPriorPeriod` gives delta suppression a single home rather than scattered null checks.

---

## ADR-0006: CSV call list delivered by a server route handler

**Status**: Accepted — 2026-08-24

### Context

Spec FR-039 requires every alert to yield a downloadable spreadsheet-compatible call list. The
source `plan.md` §4.3 explicitly argues the opposite — that URL-as-state means "sharing for free,
no export feature needed". Constitution I forbids lead records reaching the browser, which rules
out client-side CSV generation.

### Decision

A single Next.js Route Handler, `GET /api/call-list?insight=<id>&<filters>`, returning `text/csv`
with a `Content-Disposition` attachment. CSV serialisation is a pure function in
`lib/export/csv.ts`; the handler resolves the insight by id, maps its `evidence` lead ids through
`dataset.leadById`, and serialises server-side. Fixed ten-column shape, UTF-8 BOM, CRLF, rupees as
bare integers.

### Consequences

- **Deliberate deviation from `plan.md` §4.3.** Justified by FR-039, which post-dates the plan and
  was a user decision during `/speckit-clarify`.
- Constitution I holds: the browser receives finished CSV text, never a lead record.
- Introduces the product's only HTTP endpoint. Kept narrow — per-alert only, fixed columns, no
  configuration — so it does not become a general API layer and does not contradict ADR-0002. The
  spec's Out of Scope section bars bulk and configurable export.
- Requires `Insight.id` to be stable and resolvable (ADR-0008).
- An id can legitimately 404 when filters change and the insight no longer fires. Expected
  behaviour, not an error to log.
- Rejected: clipboard copy from a client component (needs lead data client-side, violates
  Constitution I). Rejected: Server Action returning a string (downloads are what
  `Content-Disposition` is for).

---

## ADR-0007: URL is the sole filter-state store

**Status**: Accepted — 2026-08-24

### Context

Filter state has to reach server components to drive recomputation. The alternatives are a client
store synchronised to the server, or the URL itself. Spec FR-028 requires every view to be
reproducible from its address; FR-029 requires filters to survive drill-through.

### Decision

Filter state lives in `searchParams` and nowhere else. No client store, no context provider, no
`localStorage`. `parseFilters()` is total and never throws — malformed input degrades to defaults.
`buildHref()` is the only sanctioned way to construct an internal link.

### Consequences

- Sharing is free: every view is already a URL. No export feature needed for sharing (which is
  what `plan.md` §4.3 got right).
- Server components recompute naturally on navigation; no synchronisation problem exists.
- Filter changes are navigations, so interaction cost is a round trip. Acceptable — the payload is
  small and the alternative violates Constitution I.
- Routing filter changes through `buildHref()` is a convention; a call site that hand-builds a URL
  would silently drop filters. Needs review attention.
- Total parsing means a malformed URL renders the default view rather than an error, satisfying
  SC-006 by construction.

---

## ADR-0008: Insight identity is `rule:entity` with a total ordering

**Status**: Accepted — 2026-08-24

### Context

FR-010 requires identical inputs to produce identical insights in identical order. FR-040 requires
the CSV endpoint to resolve "the alert I am looking at" reproducibly. Array position is not a
stable handle — it changes as filters change.

### Decision

Every insight carries `id = ${ruleSlug}:${entityId}` — e.g. `never-contacted:B3`,
`channel-quality:social_media`. Ranking is a total order: severity rank → `impactRupees`
descending with `null` last → `id` ascending as final tiebreak.

### Consequences

- Ids are URL-safe, human-legible in a shared link, and stable across runs.
- The `id` tiebreak is what makes the ordering *total*. Without it, two insights of equal severity
  and equal impact could swap between runs depending on rule execution order, silently breaking
  FR-010. This is the whole point of the third sort key.
- `impactRupees: null` must sort last and must stay distinct from `0` — "no money at stake" is not
  "zero rupees at stake".
- One insight per rule per entity. A rule needing multiple insights for one entity would require a
  richer id scheme and a superseding ADR.
- Rejected: content hashing — opaque in URLs and breaks shared links whenever wording changes.

---

## ADR-0009: Group target attainment is 11.2%, not 13%

**Status**: Accepted — 2026-08-24

### Context

The source `plan.md` §2 states "Targets are fiction — Group attainment ≈13% (160 delivered vs
1,426 target units)". That figure propagated into Constitution Principle V as a mandatory test
fixture and into spec SC-003 as a published number.

Direct computation over `docs/dealership_data.json` during Phase 0: 160 ÷ 1,426 = **11.22%**. The
stated inputs do not produce the stated output. Revenue attainment (₹38.88 Cr ÷ ₹313.01 Cr =
12.4%) does not round to 13% either, so this is not a units-versus-revenue definitional difference
— it is an arithmetic error.

A second error was found in the same section: losses at the `new` stage are **120** of 288, not the
stated 118.

### Decision

Group attainment is **11.2% by units**. The implementation asserts 11.2%. Spec SC-003 has been
corrected. Losses-at-`new` is 120.

Constitution Principle V currently pins "Group target attainment ≈ 13%" as a required fixture and
**must be amended via `/speckit-constitution` before the test suite is written**, or the
Constitution and the data will contradict each other.

### Consequences

- **Blocks the test phase** until the Constitution is amended. Principle V forbids changing a
  pinned fixture without a decision-log entry first; this ADR and the corresponding log entry are
  that record.
- Constitution Principle III (honest numbers over flattering numbers) is what surfaced this.
  Publishing 13% would have been exactly the unverified figure the principle exists to prevent —
  in a product whose central claim is that its arithmetic can be trusted.
- Every other figure in `plan.md` §2 was re-verified and holds: the funnel, Lakeside's 58% contact
  rate, ₹8.59 Cr across 38 stuck orders, ₹38.88 Cr delivered, 18.3-day average delivery, and all
  six channel conversion rates.
- The oldest stuck order is 194 days from `DATA_AS_OF`, not the stated 195. Too minor for its own
  ADR; recorded in the decision log.
- Rejected: redefining attainment as revenue-based to get nearer 13% — 12.4% still isn't 13%, and
  reverse-engineering a definition to fit a wrong number inverts the principle that caught it.

---

## ADR-0010: Repository flattened — application moved to the git root

**Status**: Accepted — 2026-08-24

### Context

ADR-0001's nested layout (application at `C:\Projects\Assignment\Assignment`, git root one level
up at `C:\Projects\Assignment`) required Vercel's project **Root Directory** to be manually set to
`Assignment` on every import. The user reported this was causing friction hosting the project via
Vercel's GitHub integration and asked for the nesting itself to be resolved, not worked around.

Two options existed: flatten the repository (move the application up to the git root), or leave
the layout as-is and rely on Vercel's Root Directory setting (which exists precisely for this
case). Asked directly; the user chose to flatten.

Two files that lived at the git root outside the application (`docs/ASSIGNMENT.md`, the original
assignment brief, and `docs/dealership_data.json`, the original untouched dataset copy) had already
been deleted from disk by the user before this ADR, intentionally, prior to the flatten — confirmed
with the user rather than assumed. Neither is restored or reintroduced by this change.

### Decision

Every tracked file that lived under `Assignment/` — `src/`, `docs/decisions/`, `specs/`, `tests/`,
`.specify/`, `DECISIONS.md`, `README.md`, `package.json`, and every config file — was moved
(`git mv`, preserving history) up to the git root. The git root and the application root are now
the same directory: `C:\Projects\Assignment`. Untracked/gitignored build artifacts
(`node_modules/`, `.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`) were deleted rather than moved
and regenerated fresh (`npm install`, `npm run build`) at the new location, to avoid trusting a raw
directory move of generated output that might embed absolute paths.

`plan.md` (the pre-Spec-Kit seed document, at the git root, distinct from
`specs/001-dealership-performance-dashboard/plan.md`) was left in place — it sits at a different
path than the Spec Kit plan and the flatten creates no collision with it.

### Consequences

- **Vercel's Root Directory setting is no longer needed.** Importing the repository directly from
  GitHub now finds `package.json` at the root with no configuration.
- ADR-0001 is superseded, not deleted — its reasoning was correct for the layout at the time, and
  the "reversible cheaply before implementation starts; expensive afterwards" consequence it
  predicted turned out accurate: this reversal happened after eight of nine implementation phases
  were already complete, touching roughly 150 tracked files via `git mv`.
- Full re-verification was required and performed post-move: fresh `npm install`, `npx tsc --noEmit`,
  `npx eslint .`, `npx vitest run` (149/149 passing, unchanged), `npm run build` (unchanged route
  output), and the `.next/static` dataset-leak gate — all identical to pre-move results, confirming
  the move was purely mechanical and changed no behavior.
- The empty `Assignment/` directory could not be removed in the session that performed this move —
  something held an OS-level lock on it (confirmed via both a Bash and a PowerShell removal attempt
  failing identically with "resource busy"), most likely the coding harness's own working-directory
  handle rather than a leftover build process. Harmless: git does not track empty directories, so it
  does not appear in the repository at all; left for manual deletion once the lock releases.
- Historical references to the old nested path (`C:\Projects\Assignment\Assignment`, "Root Directory
  must be set to `Assignment`") remain unedited in `docs/decisions/decision-log.md`,
  `specs/.../research.md`, and `specs/.../plan.md` — those are dated, historical records of
  decisions made under the old layout, consistent with this project's append-only decision-log
  convention. Forward-facing, actionable documents (`README.md`, `specs/.../quickstart.md` Gate 7,
  `specs/.../tasks.md` T108) were updated to match the new layout.
- Rejected: leaving the nested layout and only documenting Vercel's Root Directory setting more
  prominently — rejected because the user explicitly asked for the nesting itself to be resolved,
  not for a better explanation of the workaround.


## ADR-0011: The product is framed around gates, not funnel stages

**Status**: Accepted

**Context**: v1 presented a six-stage funnel as its primary diagnostic. A second analysis pass
established that this dataset's funnel is strictly sequential (zero stage skips across 510 leads)
and that the test drive is an absolute gate: of 391 contacted leads, the 91 that never took one
produced zero deliveries. Two steps therefore decide 41.2% of all leads and Rs 52.16 Cr before any
closing skill applies.

**Decision**: Gate analysis (`lib/analytics/gates.ts`) is the primary frame. `computeGatesFor` takes
an explicit lead pool so the same function serves the group view and a branch view without the scope
confusion ADR-0005 exists to prevent. Gate figures are never scoped by the reader's time window —
they are structural, and a narrow window must not shrink them.

**Consequences**: The overview leads with three gates and their monetary loss. The six-stage funnel
survives as a diagnostic on `/funnel`. A branch page shows its own gates beside its funnel. The
framing is stated in-product with its evidence (0 of 91) rather than asserted.

## ADR-0012: Ranking and headline selection are separate concerns

**Status**: Accepted

**Context**: `runInsights()` returns a strict total order. Slicing its top five for the landing feed
produced four cards from one rule at four branches.

**Decision**: `runInsights()` keeps the total order unchanged. A new `selectHeadlines()` performs
round-robin selection across rules for presentation only.

**Consequences**: The CSV endpoint, branch pages and the FR-010 determinism guarantee are unaffected
— they consume the total order. The feed spans distinct problem types. The tradeoff is that the
visible five are not strictly the five most severe instances, which is stated in `DECISIONS.md`.

## ADR-0013: Charts are server-rendered unless interactivity earns the JavaScript

**Status**: Accepted

**Context**: v1 shipped Recharts on all routes (~210 kB first load), including pages with no
interactive chart.

**Decision**: Charts are HTML/CSS or inline SVG with native `title` tooltips by default. Recharts is
used only for `TrendChart` (crosshair over a time series) and `RepScatter` (per-point tooltip in a
2-D field).

**Consequences**: Seven of nine routes ship no chart JS (~106 kB). Chart components stay Server
Components, so view-shaped data never crosses the client boundary. Tooltip appearance is the
browser's native rendering and cannot be styled — accepted, since it is keyboard- and
screen-reader-accessible for free.

## ADR-0014: Design-token contrast is asserted by test, not reviewed

**Status**: Accepted

**Context**: v1 recorded its accessibility pass as "verified by structural code review". Measuring
the rendered pages found three real WCAG failures, one of them a colour that fails against both
black and white text.

**Decision**: `tests/design/contrast.spec.ts` parses `globals.css` and asserts every
text/background token pair against its WCAG floor, in both themes. Constitution Principle VIII
generalises the rule.

**Consequences**: A palette edit that breaks the floor fails the suite rather than shipping. The
sequential ramp's ink flip and the exclusion of `#2a78d6` from the dark ramp are both pinned by
test. Contrast is no longer something a reviewer has to remember to check.
