# Phase 0: Research & Unknown Resolution

**Feature**: Dealership Performance Dashboard (DealerPulse)
**Date**: 2026-08-24

All findings below were verified by direct computation over `docs/dealership_data.json`, not
inferred from the source `plan.md`. Where the two disagree, the data wins and the discrepancy is
recorded.

---

## R1. Dataset shape

**Decision**: Six top-level keys — `metadata`, `branches` (5), `sales_reps` (30), `leads` (510),
`targets` (35), `deliveries` (160).

**Verified field shapes**:

- `branches[]`: `id` (`B1`–`B5`), `name`, `city`
- `sales_reps[]`: `id` (`SR1`–`SR30`), `name`, `branch_id`, `role`, `joined`
- `leads[]`: `id` (`L0001`…), `customer_name`, `phone`, `source`, `model_interested`, `status`,
  `assigned_to`, `branch_id`, `created_at`, `last_activity_at`, `status_history[]`,
  `expected_close_date`, `deal_value`, `lost_reason`
- `status_history[]`: `status`, `timestamp`, `note`
- `targets[]`: `branch_id`, `month` (`YYYY-MM`), `target_units`, `target_revenue`
- `deliveries[]`: `lead_id`, `order_date`, `delivery_date`, `days_to_deliver`, `delay_reason`

**Rationale**: The data model cannot be designed against a guessed schema, and `plan.md` §4.1
describes enrichment without ever stating the raw shape.

**Categorical domains** (closed sets — model as unions, not `string`):

- `status` / `status_history[].status`: `new`, `contacted`, `test_drive`, `negotiation`,
  `order_placed`, `delivered`, `lost`
- `source`: `walk_in`, `website`, `phone_enquiry`, `referral`, `social_media`, `auto_expo`
- `sales_reps[].role`: `branch_manager`, `sales_officer`
- `delay_reason`: 7 values plus `null` (88 of 160 deliveries have no delay reason)
- `lost_reason`: 8 distinct values

**Alternatives considered**: Treating categoricals as `string`. Rejected — a typo in a rule
predicate would then fail silently at runtime instead of at compile time, and these rules are the
product.

---

## R2. Group target attainment — source figure is wrong

**Decision**: Group attainment is **11.2% by units** (160 delivered ÷ 1,426 target units).
Revenue attainment is 12.4% (₹38.88 Cr ÷ ₹313.01 Cr). The implementation asserts **11.2%**.

**Rationale**: `plan.md` §2 states "≈13% (160 delivered vs 1,426 target units)" — but
160 ÷ 1,426 = 11.22%. The stated inputs do not produce the stated output. Revenue attainment
(12.4%) does not round to 13% either, so this is not a units-vs-revenue definitional difference;
it is an arithmetic error. Constitution Principle V and spec SC-003 both inherited it.

**Consequence**: SC-003 corrected to 11.2%. Constitution Principle V requires amendment via
`/speckit-constitution` — see ADR-0009. Under Principle III (honest numbers), shipping 13% would
be exactly the kind of unverified figure the constitution exists to prevent.

**Alternatives considered**: Defining attainment as revenue-based to get closer to 13%. Rejected —
12.4% still isn't 13%, and reverse-engineering a definition to match a wrong number inverts the
principle.

---

## R3. Losses at `new` — source figure is wrong (superseded — see below)

**Decision**: **120** of 288 losses occur from the `new` stage (never contacted), not 118.

**Method**: For each lost lead, the stage immediately preceding the `lost` entry in
`status_history`. Full distribution: `new` 120 · `contacted` 79 · `test_drive` 57 ·
`negotiation` 32.

**Rationale**: Off-by-two in the source plan. Small, but the loss-stage breakdown is displayed
(FR-015) and would be asserted in tests.

> **Superseded during implementation (2026-08-24).** This verification script selected "lost"
> leads via the raw `status` field and took `history[length-2]` as the prior stage for every one
> of them — it never checked whether `status_history` actually contained a `lost` entry. 14 leads
> carry `status: "lost"` with no `lost` entry anywhere in their `status_history` (and
> `lost_reason: null` on all 14, and `last_activity_at` exactly matching their last real history
> entry — corroborating that they were never actually lost). Constitution III requires
> `status_history` to be authoritative, so these 14 are correctly open, not lost. The properly
> status_history-derived figures are **274 total losses**: `new` 112 · `contacted` 75 ·
> `test_drive` 55 · `negotiation` 32. Full account in `docs/decisions/decision-log.md`.

---

## R4. Stuck orders — two distinct sets, easily conflated

**Decision**: Maintain and name both.

| Set | Definition | Count | Value | Used by |
|---|---|---|---|---|
| All stuck orders | `status === 'order_placed'`, no delivery record | 38 | ₹8.59 Cr | FR-018, FR-019 headline; the watchlist |
| Alerting stuck orders | of those, order placed ≥27 days before `DATA_AS_OF` | 25 | — | Insight rule 3 (FR-011) |

**Verified**: all 38 `order_placed` leads have no matching delivery. Ages range 0–195 days,
mean 65.2. Oldest is **195** days from `DATA_AS_OF` — matching `plan.md` exactly.

> **Correction during implementation (2026-08-24).** This section originally claimed 194, not
> 195, based on a PowerShell verification script that implicitly converted UTC timestamps to the
> local system timezone before flooring to a calendar date. Node.js and the actual shipped
> `daysBetween`/`floorToUtcDate` (explicit UTC throughout) both compute 195. `plan.md`'s original
> figure was correct; this was a planning-time verification error, not a plan.md error. Full
> account in `docs/decisions/decision-log.md`.
By branch: Eastside 12 · Central 9 · Highway 7 · Downtown 6 · Lakeside 4.

**Rationale**: The spec's SC-003 pins "38 … ₹8.59 Cr" while FR-011 rule 3 fires at ≥27 days. A
reader could reasonably implement one number and test the other. Naming both prevents it.

**Alternatives considered**: Lowering rule 3's threshold to 0 days so both sets coincide. Rejected
— 27 days is the user-selected threshold (≈1.5× the 18.3-day average) and an alert on an order
placed yesterday is noise, not a problem.

---

## R5. `DATA_AS_OF` derivation

**Decision**: `DATA_AS_OF` = maximum timestamp across all lead `created_at`, `last_activity_at`,
and `status_history[].timestamp` values = **2025-12-31T19:10:00Z**. Computed at module scope,
never hardcoded (Constitution VII).

**Verified bounds**: earliest lead timestamp 2025-06-01T18:46:00Z; latest delivery_date
2025-12-30; latest order_date 2025-12-21.

**Rationale**: Lead timestamps run later than delivery dates, so scanning deliveries alone would
place `DATA_AS_OF` a day early and shift every age calculation.

**Day-boundary rule**: age comparisons floor both operands to UTC date before differencing, so
"27 days old" is stable regardless of time of day. Without this, a rule sitting exactly on its
threshold could flip based on the clock time embedded in a timestamp.

**Alternatives considered**: Using `metadata.generated_at` (2026-03-03). Rejected — that is when
the file was generated, not what the data covers; it would report the group as 8 months stale on
data ending 31 Dec 2025 and would corrupt every age figure.

---

## R6. Rolling time presets against a historical extract

**Decision**: "Last 30 days" and "last 90 days" count back from `DATA_AS_OF`, not from
`REAL_NOW`.

**Rationale**: Today is 2026-08-24; the data ends 2025-12-31. Anchored to the real clock, both
rolling presets would resolve to windows containing zero records — the product's two most
prominent presets would show empty states permanently. Already captured in spec FR-026.

**Consequence**: `REAL_NOW` is used for exactly one thing — the freshness banner's "N months
behind live" phrasing. Nothing else in the product may read the system clock.

---

## R7. Threshold viability against real data

**Decision**: All nine FR-011 thresholds fire sensibly. Verified rule by rule.

| Rule | Threshold | Behaviour on this data |
|---|---|---|
| 1 Never-contacted | ≥5 open uncontacted per branch | Lakeside 33 never-contacted — fires hard |
| 2 Contact-rate | <70% | Lakeside 58.2% fires; peers 78.0–82.5% do not ✅ clean separation |
| 3 Stuck orders | ≥27 days | 25 of 38 fire |
| 4 Cold leads | ≥7 days no activity | Fires across open leads; severity steps at 14/30 |
| 5 Funnel collapse | ≥15pp below group at a stage | Lakeside delivered 7.6% vs group 31.4% — fires |
| 6 Rep outlier | ≥15pp below branch avg, ≥15 leads | Fires; 30 reps ÷ 510 leads ≈ 17 each, so most qualify |
| 7 Lost-reason | ≥40% of a branch's losses, ≥10 losses | **May legitimately fire zero** — 8 reasons spread over ~58 losses/branch |
| 8 Channel | <20% conversion, ≥10% volume | social_media 13.9% at 14.1% volume — fires alone ✅ |
| 9 Delay-reason | ≥40% of a branch's delayed deliveries, ≥5 | 72 delayed across 5 branches ≈ 14 each; borderline |

**Rationale**: A threshold that never fires is dead code; one that fires on everything is noise.
Rules 2 and 8 separate cleanly, which is what makes the Lakeside and social_media stories legible.

**Consequence**: Rules 7 and 9 may produce zero insights. That is correct behaviour, not a bug —
tests must assert the rule *runs* and returns `[]`, not that it returns findings. FR-009b's
empty-state requirement covers the display side.

---

## R8. Where the application lives

**Decision**: Application root is `C:\Projects\Assignment\Assignment` — the Spec Kit root and the
active working directory. The dataset is copied to `src/data/dealership_data.json`;
`../docs/dealership_data.json` stays untouched.

**Rationale**: The git repository root is one level up (`C:\Projects\Assignment`), where `docs/`
and the source `plan.md` live, while Spec Kit was initialised in the nested `Assignment/` folder.
Splitting the app across both would put `src/` outside the working directory that `/implement`
runs in and would make every path in the Constitution wrong.

**Consequence**: Vercel's project **Root Directory** must be set to `Assignment`, since the git
root is the parent. One configuration field, recorded so it is not discovered during deploy.

**Alternatives considered**: (a) App at the git root, Spec Kit left nested — rejected, splits the
project and breaks Constitution paths. (b) Re-initialising Spec Kit at the git root — rejected as
disruptive to artifacts already written and approved. See ADR-0001.

---

## R9. Producing the CSV call list

**Decision**: A single Next.js Route Handler, `GET /api/call-list`, returning `text/csv` with a
`Content-Disposition` attachment filename. CSV text is produced by a pure function in
`lib/export/csv.ts`; the handler resolves the insight, takes its evidence set, and streams the
result.

**Rationale**: Keeps Constitution I intact — the evidence rows are resolved server-side from the
dataset and the browser receives only the finished CSV. A client-side implementation would require
shipping lead records to the browser to serialise them, which is precisely what Principle I
forbids.

**Note**: `plan.md` §4.3 argues URL-as-state means "no export feature needed". This is a
deliberate, narrow deviation driven by spec FR-039 — per-alert only, fixed columns, no
configuration. Recorded as ADR-0006 and in the decision log.

**Alternatives considered**: (a) Clipboard copy from a client component — rejected, needs lead
data client-side. (b) Server Action returning a string — rejected, downloads are what
`Content-Disposition` is for, and a Server Action would still need client code to trigger the save.

**Excel compatibility**: CSV is written with a UTF-8 BOM and CRLF line endings so Indian customer
names render correctly when opened in Excel; rupee values are written as plain integers (no
grouping separators, no `₹` symbol) so spreadsheets parse them as numbers. Human-readable currency
formatting belongs on screen, not in a column meant for sorting.

---

## R10. Insight identity and determinism

**Decision**: Every insight carries a deterministic `id` of the form `<rule-slug>:<entity-id>` —
e.g. `never-contacted:B3`, `channel-quality:social_media`, `stuck-orders:B5`. Ranking is a total
order: severity rank, then `impactRupees` descending, then `id` ascending as the final tiebreak.

**Rationale**: FR-010 and FR-040 both require reproducibility. The CSV endpoint needs a stable
handle for "the alert I am looking at", and array position is not stable. The `id` tiebreak
guarantees a total order — without it, two insights with equal severity and equal impact could
swap between runs depending on rule execution order.

**Alternatives considered**: Hashing the insight content. Rejected — opaque in URLs, and changes
whenever wording changes, breaking any shared link.

---

## Resolved unknowns summary

Every `NEEDS CLARIFICATION` from Technical Context is resolved. No open questions block Phase 1.

| Unknown | Resolution |
|---|---|
| Raw dataset schema | R1 — verified, closed categorical unions |
| Correct attainment figure | R2 — 11.2%; source plan wrong; needs constitution amendment |
| Loss-stage distribution | R3 — 112 at `new` (274 total), status_history-derived; supersedes both the plan's 118 and R3's own first-pass 120 |
| Stuck-order set definition | R4 — 38 total vs 25 alerting; both named |
| `DATA_AS_OF` value and derivation | R5 — 2025-12-31T19:10:00Z, computed, day-floored |
| Rolling preset anchor | R6 — `DATA_AS_OF`, not the system clock |
| Threshold viability | R7 — all nine viable; rules 7 and 9 may return empty |
| Application root | R8 — Spec Kit root; Vercel root directory = `Assignment` |
| CSV delivery mechanism | R9 — server route handler, pure serialiser, BOM + CRLF |
| Insight identity / ordering | R10 — `rule:entity` ids, total order with id tiebreak |
