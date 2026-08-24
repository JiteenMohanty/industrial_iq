<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.0.1
Bump rationale: PATCH. Factual correction to a pinned test fixture in Principle V, discovered
during /speckit-plan by recomputing every §2 figure directly against docs/dealership_data.json.
No principle added, removed, or redefined — this corrects an arithmetic error inherited from the
source plan.md ("≈13%"), which its own stated inputs (160 ÷ 1,426) do not support. Correct value
is 11.2%. See ADR-0009 in docs/decisions/architecture-decisions.md and the corresponding entry in
docs/decisions/decision-log.md.

Principles modified:
  - V. Analytics Are Tested Against Real Dataset Fixtures — "Group target attainment ≈ 13%"
    corrected to "≈ 11.2% by units (160 delivered vs 1,426 target units)".

Sections added: none this amendment.
Sections removed: none this amendment.

Deferred items / TODOs: none.

Templates requiring review (read constitution at runtime, not modified here):
  - .specify/templates/plan-template.md — Constitution Check gate should reference
    Principles I, II, V and the Decision Records section.
  - .specify/templates/tasks-template.md — task generation should emit decision-log
    append steps for phases that make library/naming/tradeoff choices.

---

Sync Impact Report (prior amendment, retained for history)
==================
Version change: (unfilled template) → 1.0.0
Bump rationale: Initial ratification. All template placeholders replaced with concrete,
project-specific governance derived from plan.md plus mandated decision-record process rules.

Principles defined (all new):
  - I. Server-Side Analytics, Zero Dataset on the Client (NON-NEGOTIABLE)
  - II. Deterministic Insight Engine, No LLM (NON-NEGOTIABLE)
  - III. Honest Numbers Over Flattering Numbers
  - IV. Every Insight Is Actionable and Drillable
  - V. Analytics Are Tested Against Real Dataset Fixtures (NON-NEGOTIABLE)
  - VI. URL Is the Only Filter State
  - VII. Single Source of Truth for Time and Formatting

Sections added:
  - Technology & Structure Constraints (replaces [SECTION_2_NAME])
  - Decision Records (NON-NEGOTIABLE) (replaces [SECTION_3_NAME])
  - Development Workflow & Quality Gates (added beyond template slots)
  - Governance

Sections removed: none (template had no prior content).
-->

# DealerPulse Constitution

DealerPulse is a dealership-group performance product: a CEO and branch managers must be able to
see what is going wrong and act on it. Every rule below exists to protect that outcome.

## Core Principles

### I. Server-Side Analytics, Zero Dataset on the Client (NON-NEGOTIABLE)

All dataset parsing, enrichment, filtering, and aggregation MUST happen on the server. Pages are
React Server Components that read filter state from `searchParams`, run the analytics layer, and
pass small computed objects to client components. The raw `dealership_data.json` (~620 KB) MUST
NOT reach the browser in any form — not as an import in a client component, not as a serialized
prop, not inside a client bundle chunk.

`"use client"` is permitted only for chart rendering, filter controls, and interaction state.
A client component MUST accept pre-computed, view-shaped data — never raw leads, never a full
collection it has to reduce itself.

**Rationale**: Payload size and time-to-interactive are graded, and shipping the dataset to the
browser makes every filter change a client-side recompute over data the server already indexed.

### II. Deterministic Insight Engine, No LLM (NON-NEGOTIABLE)

Insights MUST be produced by pure rule functions of the shape
`(ctx: AnalyticsContext) => Insight[]`. No LLM, no external AI API, no network call is permitted
anywhere in the insight or analytics path. The same dataset and the same filters MUST always
produce byte-identical insight output.

Each `Insight` MUST carry `severity`, `title`, plain-English `body`, `impactRupees`, `metric`,
`entity`, `href`, and `evidence` (the lead IDs behind the claim). Ranking is by severity, then
rupee impact.

**Rationale**: Reproducibility, zero latency, no API key for a reviewer, and no hallucinated
number attached to a real rupee figure.

### III. Honest Numbers Over Flattering Numbers

The product MUST show real values against real inputs, with the data-quality caveat stated in the
UI where the input is untrustworthy. Specifically: official targets are displayed as-is with an
explicit callout that they appear set at roughly 7x actual capacity. Invented baselines,
rescaled targets, and forecasts against known-fictional numbers are FORBIDDEN.

`status_history` is the source of truth for every stage transition. Deriving a stage from the
`status` field alone is FORBIDDEN.

Every delta MUST state its direction and its comparison basis. A number without a basis is not
shippable.

**Rationale**: The product's credibility is the deliverable. One invented number invalidates the
rest of the dashboard.

### IV. Every Insight Is Actionable and Drillable

Every insight, alert, and KPI tile MUST link through to the underlying records with the active
filter state preserved. An alert that cannot be drilled into MUST NOT ship. The drill-down floor
is the lead detail sheet showing the full `status_history` timeline.

**Rationale**: The brief is "understand performance **and act on it**". A read-only alert is a
dead end.

### V. Analytics Are Tested Against Real Dataset Fixtures (NON-NEGOTIABLE)

Every module under `src/lib/analytics/` and `src/lib/insights/` MUST have Vitest coverage that
asserts the actual verified figures from the dataset, not synthetic toy inputs. At minimum the
suite MUST pin:

- Lakeside Toyota contact rate ≈ 58%
- Group funnel 510 → 391 → 300 → 235 → 198 → 160
- 38 stuck `order_placed` leads totalling ₹8.59 Cr
- Group target attainment ≈ 11.2% by units (160 delivered vs 1,426 target units)

These tests are both regression protection and the proof that the analytics are correct. A change
that moves one of these numbers MUST be explained in the decision log before the fixture is
updated. Pure functions are tested directly; no DOM tests are required for the analytics layer.

**Rationale**: The insights are only worth as much as the arithmetic underneath them.

### VI. URL Is the Only Filter State

Filter state lives in `searchParams` (`?from=&to=&branch=&preset=`) and nowhere else. No
client-side filter store, no context provider holding the active range. Consequently every view
is a shareable link, and no export feature is needed.

Per-metric time semantics are fixed and MUST be documented in `DECISIONS.md`:
lead counts filter on `created_at`; revenue and units filter on `delivery_date`; alerts always
evaluate current open state regardless of the selected range.

**Rationale**: Server components recompute from the URL for free, and sharing a filtered view
becomes a copy-paste instead of a feature.

### VII. Single Source of Truth for Time and Formatting

`src/lib/time.ts` owns all time semantics. `DATA_AS_OF` MUST be computed as the maximum timestamp
in the dataset — never hardcoded. `REAL_NOW` is the actual wall-clock date and is used **only**
for the data-freshness banner. Every aging and pacing helper MUST take `DATA_AS_OF` as its
reference so alerts still rank meaningfully.

`src/lib/format.ts` owns all display formatting. Currency MUST render in Indian lakh/crore form
(`₹8.59 Cr`, never `₹85,900,000`). Ad-hoc date math or currency formatting outside these two
modules is FORBIDDEN.

**Rationale**: One constant to flip when the dataset is refreshed, and one place where the money
is formatted correctly.

## Technology & Structure Constraints

**Locked stack (non-negotiable — changing any entry requires an ADR):**

- Next.js 15, App Router, React Server Components
- TypeScript in strict mode, with path aliases configured
- Tailwind CSS for styling
- Recharts for charts
- Vitest for tests
- No database, no ORM, no auth, no API layer — the dataset is a static JSON file read at module
  scope, parsed and indexed once, memoised, with the per-request entry point wrapped in React
  `cache()`
- Deployment target is Vercel

**Folder layout (authoritative):**

```
DECISIONS.md
README.md
plan.md
docs/decisions/           decision-log.md · architecture-decisions.md
src/
  data/                   dealership_data.json (copy; docs/ original stays untouched)
  app/                    routes; layout.tsx · page.tsx · loading.tsx per route
  lib/
    time.ts · format.ts
    data/                 types.ts · dataset.ts
    filters/              searchParams ⇄ typed Filters, applyFilters()
    analytics/            kpis · funnel · targets · pipeline · reps · trends
    insights/             types · rules · engine
  components/
    ui/ · charts/ · filters/ · insights/ · leads/
```

**Naming conventions:**

- Route segment folders: lowercase, plural where they list (`funnel`, `deliveries`, `branches`,
  `reps`). Dynamic segments use descriptive camelCase ids: `[branchId]`, `[repId]`.
- App Router special files keep their framework names exactly: `page.tsx`, `layout.tsx`,
  `loading.tsx`.
- Component files are PascalCase and match their default export: `FunnelChart.tsx`,
  `InsightCard.tsx`, `LeadDetailSheet.tsx`.
- Library modules are lowercase, one concern per file: `time.ts`, `format.ts`, `dataset.ts`.
- Types are PascalCase singular: `Lead`, `Branch`, `Rep`, `Target`, `Delivery`, `Stage`,
  `Insight`, `Filters`, `AnalyticsContext`.
- Functions are camelCase verbs; boolean fields read as predicates (`isOpen`).
- Imports use the configured path alias, not deep relative chains.

**Design constraints:** single accent plus a neutral scale, semantic severity colours, one type
scale, tabular numerals on all figures. Every route ships a real `loading.tsx` skeleton and a
genuine empty state for filtered-to-zero. Desktop-first, tablet-verified: no horizontal page
scroll at 1440px, 1024px, or 768px. The `dataviz` skill MUST be loaded before writing any chart
code.

## Decision Records (NON-NEGOTIABLE)

Two files under `docs/decisions/` are maintained for the life of the project. They serve
different purposes and MUST NOT be merged or used interchangeably.

### `docs/decisions/decision-log.md` — running dev journal

Append-only and chronological. Every implementation decision made during `/speckit-implement`
MUST be appended here: library choice, naming choice, tradeoff, or any deviation from `plan.md`.
Each entry MUST record:

- **Date** (ISO `YYYY-MM-DD`)
- **Phase / task ref** (e.g. `Phase 3 · T024`)
- **Decision** — what was chosen, stated in one line
- **Reasoning** — why
- **Alternatives considered** — what was rejected and why

Entries are never edited or deleted once written. A reversal is a new entry that references the
old one.

### `docs/decisions/architecture-decisions.md` — curated ADRs

Formal ADRs only, for decisions that affect system structure: data model, service boundaries,
API contracts, infrastructure choices, and any change to the locked stack. One ADR per structural
decision — not every decision. Standard format, numbered sequentially from `ADR-0001`:

- **Title**
- **Status** — Proposed · Accepted · Superseded by ADR-XXXX
- **Context**
- **Decision**
- **Consequences**

### Consultation rule

Every `/speckit-plan` and `/speckit-implement` run MUST read both files before proposing work.
Proposing anything that contradicts a prior recorded decision is FORBIDDEN unless a new ADR is
written that explicitly supersedes the old one; the superseded ADR's Status MUST be updated to
point at its replacement in the same change.

`DECISIONS.md` in the project root remains the reviewer-facing deliverable — a curated narrative
for the assignment, distinct from these two working files.

## Development Workflow & Quality Gates

Work proceeds through the phases defined in `plan.md`. A phase is not complete until its gates
pass.

**Gates that MUST pass before any phase is marked done:**

1. `npm run build` — clean, zero TypeScript errors.
2. `npx vitest run` — green, with the §V fixture numbers asserted.
3. Payload check — inspect `.next/static` and confirm `dealership_data.json` appears in no client
   chunk.
4. Decision log updated for every decision made in that phase.

**Gates before deploy:**

5. Every route walked in `npm run dev`: Action Center click-through lands on the correct
   branch/rep/lead with filters preserved; time-range changes recompute all views and update the
   URL; a zero-result range renders an empty state rather than crashing.
6. Responsive pass at 1440px, 1024px, and 768px with no horizontal page scroll.
7. Accessibility pass: labels, contrast, keyboard navigation.
8. Storytelling acceptance test: the Lakeside Toyota story is discoverable in under 30 seconds
   from a cold open.

Scope discipline: the differentiators are the Action Center, the conversion funnel with branch
overlay, and the stuck-order/delivery board. Rep drill-down is a hard requirement and ships in
basic form. Work outside `plan.md` §5 requires a decision-log entry justifying it before it
starts.

## Governance

This constitution supersedes all other development practices for DealerPulse. Where a prompt, a
template, or a convenience conflicts with a rule here, this document wins.

**Amendment procedure**: Amendments are made only through `/speckit-constitution`. Each amendment
MUST update the version line, carry a Sync Impact Report at the top of this file, and — when it
changes a structural constraint — be accompanied by an ADR in
`docs/decisions/architecture-decisions.md`.

**Versioning policy** (semantic):

- **MAJOR** — a principle is removed or redefined in a backward-incompatible way.
- **MINOR** — a principle or section is added, or guidance is materially expanded.
- **PATCH** — clarifications, wording, typo fixes, non-semantic refinements.

**Compliance review**: Every `/speckit-plan` run MUST perform a Constitution Check against these
principles before producing design artifacts, and MUST record any justified deviation in the
decision log. Every `/speckit-implement` run MUST read both decision-record files before starting
and MUST append to `decision-log.md` as it works. Rules marked NON-NEGOTIABLE cannot be waived by
a decision-log entry; they require a superseding ADR and a MAJOR amendment here.

**Runtime guidance**: `plan.md` is the working build document — scope, architecture, and phase
progress. This constitution governs how that plan is executed.

**Version**: 1.0.1 | **Ratified**: 2026-08-24 | **Last Amended**: 2026-08-24
