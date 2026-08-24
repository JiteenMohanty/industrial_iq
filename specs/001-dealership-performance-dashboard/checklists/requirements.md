# Specification Quality Checklist: Dealership Performance Dashboard (DealerPulse)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Resolved 2026-08-24 — FR-011, detection thresholds.** `plan.md` §4.4 defined all nine rules
qualitatively ("significantly below group median", "beyond ~1.5x the 18.3-day average",
"meaningful lead volume", "far below branch peers", "one reason spiking"), fixing no numbers.
User selected fixed absolute thresholds over relative-to-median or statistical alternatives.
FR-011 now carries a nine-row threshold table, and FR-011a excludes below-minimum-sample entities
outright. Thresholds verified against the known data: Lakeside's 58% contact rate breaches the 70%
floor while peers at 78–82% do not; social_media's 14% conversion breaches the 20% floor while all
other channels clear it; all 38 stuck orders exceed the 27-day mark. Tradeoff accepted: absolute
thresholds are tuned to this extract and will need review if the data is replaced — recorded as an
assumption in the spec.

**Resolved 2026-08-24 — FR-038, meaning of "act".** The brief requires users to *act* and names
the primary surface an Action Center, but no section of `plan.md` describes any state change.
User selected read-only plus a per-alert call list, over pure read-only or ephemeral
dismiss/snooze state. FR-038 now forbids record mutation and persisted reader state outright;
FR-039–FR-041 require every alert to yield a takeable call list of its evidence set, carrying the
qualifying figure per record, reproducible and side-effect-free. SC-012 tightened to a one-minute
bar and SC-013 added for full alert coverage. Out of Scope updated: bulk export and persisted
reader state both explicitly excluded, so the call list stays a narrow, well-bounded addition
rather than an export feature.

Both markers are now resolved; no `[NEEDS CLARIFICATION]` markers remain in the spec.

A third candidate — the comparison window for period-over-period deltas — was resolved as a
documented assumption rather than a marker, since a reasonable default exists (preceding window
of identical length, delta suppressed when it falls outside data coverage).

Content-quality items were re-verified after drafting: `plan.md` §3.1's stack, §4's file tree,
and §4.7's test tooling were deliberately excluded, and success criteria were written as
user-observable outcomes rather than system internals.

### `/speckit-clarify` pass — 2026-08-24

Re-validated against the updated spec: **16/16 → 16/16 items passing.** No state changes, no
regressions. Six clarifications were integrated, two resolved from `plan.md` without asking and
four answered by the user.

Resolved from `plan.md` (not asked): time-range presets are exactly last 30 days / last 90 days /
each month Jun–Dec 2025 / full range / custom (§4.3, folded into FR-026 with rolling presets
anchored to the data's last date rather than today); severity is exactly critical / warning / info
(§4.4, folded into FR-006).

Answered by the user:

- **Branch filter scopes the alert feed** (FR-009a, FR-009b). `plan.md` §4.3 fixes only that
  alerts ignore the *time* range and is silent on the branch filter. Alerts now narrow to the
  selected branch; comparative alerts retain the group figure they are measured against; an empty
  feed states so explicitly.
- **Call list is a downloadable CSV** (FR-039, FR-040, FR-040a). Note: this is a deliberate
  deviation from `plan.md` §4.3, which argues URL-as-state means "no export feature needed". Kept
  narrow — per-alert only, fixed column shape, no configuration — and Out of Scope was tightened
  to bar bulk export and configurable exports. Requires a decision-log entry when built, per the
  constitution.
- **Feed shows top 5** (FR-007a), remainder behind one control with the hidden count visible.
  Safe against burying urgent items because FR-007 already ranks severity before impact.
- **WCAG 2.1 Level AA** (FR-037, SC-009a). Replaces the previously untestable "standard contrast
  and labelling" wording with explicit ratios, keyboard operability, accessible naming, and the
  no-colour-alone rule — which also constrains chart palette work, recorded as an assumption.

Content-quality re-check after these edits: "CSV"/"spreadsheet-compatible" and "WCAG 2.1 AA" were
judged user-facing deliverable properties rather than implementation details — they describe what
the manager receives and what the product must satisfy, not how it is built — so the
no-implementation-details items remain checked.

**Outstanding (low impact, not asked):** no latency or responsiveness target exists anywhere in
the spec or `plan.md` §6. Judged immaterial at this data volume — 510 leads computed server-side —
and better settled during planning if it matters at all.

Spec is ready for `/speckit-plan`.
