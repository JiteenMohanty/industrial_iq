# Feature Specification: Gate-First Dealership Intelligence (DealerPulse v2)

**Feature Branch**: `002-gate-first-dashboard`

**Created**: 2026-08-26

**Status**: Implemented

**Supersedes**: `001-dealership-performance-dashboard`. That spec is retained unchanged as the
record of the first submission; where the two conflict, this one governs.

**Input**: Second-submission rebuild. Re-read the assignment brief and the dataset from scratch,
audit the shipped v1, and rebuild rather than retouch.

---

## Why This Exists (v2)

v1 answered "which branch is failing" correctly and stopped there. A second, deeper pass over the
dataset found that the question it should have been answering is different, and that the answer is
structural rather than comparative.

**The finding that reframes the product**: the funnel is strictly sequential — across all 510
leads, not one skips a stage — and the test drive is an *absolute* gate. Of the 391 leads that were
contacted, 91 never took a test drive, and **zero** of those 91 reached negotiation, an order, or a
delivery. Combined with the 119 leads never contacted at all, **210 leads (41.2% of everything
received), carrying ₹52.16 Cr, died before a customer ever sat in a car.**

That changes what the dashboard is for. A lead stalled before the test drive is not a
lower-probability opportunity to be nurtured; it is a closed one. Two gates — *did we call them*
and *did we get them into a car* — fix the size of the pool that every downstream skill competes
over. So the product leads with the gates, and treats conversion, revenue and rep performance as
consequences of them.

Three further findings shape the rest of the build:

1. **It is not capacity.** The worst-performing branch carries the *lightest* lead load in the
   group (15.8 leads per officer against 25.4 at the best-loaded branch) and still posts the worst
   contact rate. "They are overwhelmed" is not available as an explanation.
2. **Revenue is a mix problem too.** One model is 18% of leads and 32% of revenue; another is 25%
   of leads and 10% of revenue. A dashboard that counts only units cannot see this, and v1 ignored
   `model_interested` entirely.
3. **Reliability does not follow revenue.** The group's highest-earning branch is also the one most
   likely to miss the delivery date it quoted the customer. Nothing in a units-and-revenue view
   surfaces that.

## What Was Wrong With v1 (audit findings this spec responds to)

| # | Finding | Requirement |
|---|---|---|
| 1 | The alert feed's top 5 was four instances of one rule at four branches — the most severe items, and a poor summary of the business | FR-101 |
| 2 | "View evidence" landed on a branch summary that never listed the alert's records; the CSV was the only real path to them | FR-102 |
| 3 | `model_interested` was never used — a whole dataset dimension unanalysed | FR-110 |
| 4 | No per-rep list view; reps were reachable only by drilling through a branch | FR-120 |
| 5 | Lead source analysis was a three-column table on the funnel page | FR-115 |
| 6 | `expected_close_date` was never used; promise reliability was invisible | FR-130 |
| 7 | Responsive and accessibility were recorded as "verified by structural code review" | FR-140, FR-141 |
| 8 | Six KPI tiles each repeated "No comparable prior period" on a cold open | FR-100 |
| 9 | Every route shipped the chart library (~210 kB first load) even where nothing was interactive | FR-142 |

## User Scenarios

### US1 — Cold-open triage (P1)

A CEO opens the dashboard having never seen it. Within ten seconds they know the group's position,
where the business is being lost, and what the single largest recoverable sum is. Within thirty
they can name the failing branch and say why.

**Independent test**: open `/` with no filters. The headline figures, the gate breakdown, and a
ranked feed of *distinct* problems are all above the fold or one scroll from it. The largest
callout states a rupee figure and the mechanism behind it.

### US2 — From an alert to the phone (P1)

A branch manager reads an alert claiming 33 leads were never contacted, clicks through, and is
looking at those 33 leads with customer names and phone numbers — then downloads them as a call
list.

**Independent test**: every alert's evidence link lands on a lead list whose row count equals the
alert's evidence count.

### US3 — Diagnose a branch (P2)

A regional manager opens a branch and sees its own gates, its funnel against the group, its own
alerts, its reps, and its model mix — enough to distinguish "broken at one stage" from "broken
everywhere".

### US4 — Coach a rep (P2)

A sales manager sees which reps carry volume without converting it, and which convert well on a
light book — then sees the two numbers a rep actually controls (contact rate, test-drive rate)
rather than only the scoreboard.

### US5 — Understand demand (P3)

A CEO sees which vehicles customers ask about, where that interest lands, and whether it converts —
and can tell a demand problem from a capability problem.

### US6 — Understand acquisition (P3)

A marketing lead sees what each channel is worth per lead supplied, and can separate "this channel
sends bad leads" from "we never worked this channel's leads".

---

## Functional Requirements

### Headline position

- **FR-100**: The overview MUST present exactly six headline metrics: delivered revenue, delivered
  units, lead-to-delivery conversion, test-drive rate, median sales cycle, and target attainment.
  Where no comparable prior period exists, that MUST be stated **once** for the row, not repeated
  on every tile.
- **FR-100a**: Metrics where a falling value is an improvement (sales cycle) MUST invert the
  good/bad reading of their change indicator without altering the sign of the number.

### The gates (new in v2)

- **FR-105**: The product MUST present the business as three sequential gates — contact, test
  drive, close — showing at each the number entering, the number passing, the number lost, and the
  deal value of what was lost.
- **FR-105a**: The gate view MUST state the evidence for the test drive being absolute — how many
  contacted-but-never-test-driven leads were ever delivered — as a figure, never as an adjective.
- **FR-105b**: Gate analysis MUST NOT be scoped by the reader's time window. It is a structural
  property of the business, and a narrow window must not make it look smaller than it is.
- **FR-106**: Each gate's loss MUST link to the specific leads that died there.

### Problem detection

- **FR-101**: The landing feed MUST show at most one alert per rule before showing a second of any
  rule, so its slots are spent on distinct problem types. The full ranked list MUST remain reachable
  and MUST retain the strict total order (severity, then impact, then id) for the CSV endpoint and
  for determinism.
- **FR-102**: Every alert MUST carry (a) a link to the entity it concerns, (b) a separate link to
  the exact records it counted, and (c) a fixed, rule-authored action line. An alert missing any of
  these MUST NOT ship.
- **FR-103**: Two detection rules are added — **test-drive gate** (a branch converting under 70% of
  contacted leads into test drives, minimum 15 contacted) and **promise reliability** (a branch
  missing its quoted delivery date on 60% or more of sales, minimum 15 delivered).
- **FR-103a**: The promise-reliability rule MUST carry a null monetary impact. The revenue is
  already banked and the cost — lost repeat business — is not something this dataset can price.
- **FR-104**: All nine v1 rules and their thresholds are retained unchanged.

### Demand and mix (new in v2)

- **FR-110**: The product MUST analyse `model_interested`: per-model lead volume, gate rates,
  conversion, revenue, revenue share, price band, and median cycle.
- **FR-111**: The product MUST provide a **customer-interest heatmap** of model against a
  selectable dimension (branch, source, month) and a selectable metric (interest volume, conversion,
  test-drive rate).
- **FR-111a**: Heatmap rate metrics MUST be suppressed below a minimum sample rather than displayed,
  so a one-lead cell can never read "100%".
- **FR-111b**: The heatmap MUST print its value in every cell, so colour is never the sole encoding.
- **FR-112**: The product MUST state that deal value is model-determined, so average selling price
  is read as a mix indicator rather than as discounting or negotiating skill.

### Lead sources (new in v2)

- **FR-115**: The product MUST give lead sources their own view, showing volume, contact rate,
  test-drive rate, conversion, revenue, and revenue per lead supplied.
- **FR-115a**: It MUST show conversion **among contacted leads** beside raw conversion, so neglect
  and lead quality are distinguishable.
- **FR-115b**: The product MUST NOT display cost per lead, ROI, or any spend-derived figure. The
  dataset carries no acquisition cost, and this MUST be stated where the ranking appears.

### Reps (new in v2)

- **FR-120**: The product MUST provide a rep benchmark listing every sales officer with contact
  rate, test-drive rate, conversion, revenue, and revenue per lead.
- **FR-120a**: It MUST plot volume against efficiency so that reps carrying a large book without
  converting it are distinguishable from reps converting well on a small one. Reference lines MUST
  be the group's own medians, never an invented external benchmark.
- **FR-120b**: Branch managers, who hold no assigned leads in this dataset, MUST be excluded from
  the benchmark and the exclusion MUST be stated.

### Delivery operations

- **FR-130**: The product MUST compare each delivery against the `expected_close_date` quoted to
  the customer, reporting the share delivered late and the typical slip, per branch and group-wide.
- **FR-131**: The product MUST show stuck-order staleness (time since last activity), so orders
  that are abandoned are distinguishable from orders that are merely late.
- **FR-132**: The product MUST NOT present an inventory-based "average days to sell". No inventory
  or stock records exist in this dataset. The two computable analogues — order-to-delivery and
  lead-to-delivery — MUST be labelled for what they actually measure, and the absence of true ADS
  MUST be stated where a reader would look for it.
- **FR-133**: Where a delay reason is outside dealership control, the product MUST say so rather
  than letting an aggregate "delayed" figure imply fault.

### Evidence

- **FR-135**: The product MUST provide a lead explorer supporting cohort filters matching the
  detection rules exactly (never contacted, no test drive, stuck orders, cold, open, lost,
  delivered), entity filters (branch, rep, model, source, stage), and URL-driven sorting.
- **FR-135a**: The explorer MUST share the detection scope — branch-filtered, never time-filtered —
  so a list opened from an alert can never contain fewer records than that alert counted.
- **FR-135b**: Every row MUST reach that lead's complete stage history.

### Presentation and quality

- **FR-140**: Every route MUST render with zero horizontal page overflow at 1440px, 1024px and
  768px, **measured** rather than reviewed.
- **FR-141**: Every text/background token pair MUST clear its WCAG 2.1 AA floor in both themes,
  asserted by test. Every interactive element MUST carry an accessible name; headings MUST NOT skip
  levels; status MUST NEVER be conveyed by colour alone.
- **FR-142**: A route MUST NOT ship chart-library JavaScript unless something on it is genuinely
  interactive. Charts whose value is static MUST be server-rendered.
- **FR-143**: Every comparative judgement (a status mark, a rank) MUST be made against the group's
  own figure and MUST display that figure beside it. Entities below a minimum sample MUST receive no
  judgement at all rather than a caveated one.
- **FR-143a**: A comparison baseline MUST be drawn from the same time range as the figures it
  judges. Comparing a branch's November contact rate against an all-time group figure compares two
  different populations.
- **FR-143b**: Status states MUST be mutually exclusive in meaning. "Not rated because the sample is
  too small" and "measured, and level with the group" are different statements and MUST NOT share a
  glyph or a label. The graded bands MUST be contiguous and exhaustive, so every measurable entity
  receives exactly one status and none falls into the unrated bucket by omission.
- **FR-143c**: Every status mark MUST be able to state, on hover and to assistive technology, the
  figure it was compared against, the gap in percentage points, and the sample it rests on. A bare
  glyph is not self-describing.

**Loading and in-place navigation (revised post-review)**

- **FR-035** *(revised)*: Views MUST NOT render a page-level loading skeleton that replaces their
  content. Measured on this build, a full-page skeleton stands 808px tall against 2083px of real
  content; swapping it in on a same-route parameter change collapses the document and makes the
  **browser** clamp the reader's scroll position — 1363px of available scroll becomes 88px. Since
  server responses measure 16-160ms, the fallback bought nothing and cost the reader their place on
  every interaction. Any future loading affordance MUST preserve document height (an overlay or an
  inline indicator), never replace the content.
- **FR-035a**: Controls that change the current view MUST preserve scroll position. Links that
  navigate elsewhere MUST NOT — scrolling to the top is correct there.
- **FR-035b**: Internal navigation MUST use client-side routing. A raw anchor to an internal route
  forces a full document reload and discards view state. The only permitted raw anchors are
  same-document fragments and file downloads the router must not intercept.

**Seasonality and head-to-head (added post-review)**

- **FR-113**: The demand view MUST report the peak *selling* month and the peak *enquiry* month
  separately, together with the lag between them, because they do not coincide and a dealership
  planning stock around "our best month" needs to know which it means.
- **FR-113a**: Seasonality MUST be branch-scoped but NOT time-scoped. A seasonality view narrowed
  to one month would name that month as its own peak — true, circular and useless.
- **FR-113b**: Any real-world calendar context offered alongside the pattern (a festival date, a
  fiscal year end) MUST be labelled as external to the dataset, and MUST NOT be stated more
  strongly than the data supports. Where the data shows a broad multi-month elevation rather than a
  single-week spike, the copy MUST say so.
- **FR-114**: The demand headline row MUST include the top-selling model by units delivered,
  distinct from the top model by revenue and the top model by enquiry volume — the three are
  different vehicles in this dataset and conflating them hides the mix finding.
- **FR-121**: The rep view MUST present a direct best-versus-worst comparison across a shared
  metric set with the gap stated per metric, and MUST identify which gate the widest gap opens at.
- **FR-121a**: Both ends of that comparison MUST clear the benchmark sample floor. Where fewer than
  two reps qualify, the view MUST render an empty state naming the floor rather than comparing thin
  books or silently disappearing.

**Filter scope contract**

- **FR-144**: Every analytics function MUST have a deliberate, documented answer to whether it
  responds to the branch filter and to the time filter. The three classes are: population views
  (both apply), present-tense state — alerts, gates, stuck orders, the lead explorer — (branch
  only, per FR-009), and cross-branch comparison tables (time only, because narrowing them to one
  row removes their purpose).
- **FR-144a**: The shared filter bar MUST NOT display a control that has no effect on the current
  view. Where a view deliberately ignores a filter, it MUST say so beside the controls rather than
  leaving the reader to infer it from a screen that did not change.
- **FR-144b**: The scope of every function MUST be asserted by test in both directions — that it
  responds where it should, and that it does not where it must not.

### Retained from v1 (unchanged)

- Server-side analytics with the dataset absent from every client bundle.
- URL as the only filter state; every view reproducible from its address.
- Per-metric time semantics (leads by creation, revenue by delivery, detection unscoped).
- Deterministic rules only — no LLM, no forecast against the known-unreliable targets.
- Indian lakh/crore currency notation throughout.
- Per-alert CSV call list.

---

## Success Criteria

- **SC-100**: A reader with no prior exposure can state the group's biggest single loss mechanism
  and its rupee value within 30 seconds of opening `/`.
- **SC-101**: The landing feed's visible alerts span at least five distinct rules whenever five
  distinct rules have fired.
- **SC-102**: For 100% of alerts, the evidence link's row count equals the alert's evidence count.
- **SC-103**: Every figure matches the dataset, verified against the shipped code path. Pinned:
  the two gates at 119 and 91 leads, zero deliveries without a test drive, ₹52.16 Cr lost
  pre-test-drive, group funnel 510 → 391 → 300 → 235 → 198 → 160, 38 stuck orders at ₹8.59 Cr,
  attainment 11.2%.
- **SC-104**: Zero routes produce an error, a blank chart, `NaN`, `Infinity`, or a stray
  `undefined` for any combination of filters, including malformed and zero-result ones.
- **SC-105**: Measured horizontal overflow is 0px on every route at all three widths.
- **SC-106**: The contrast suite passes for every token pair in both themes.
- **SC-107**: No route outside those with genuine interactivity includes chart-library JS.

## Out of Scope (unchanged from v1, reaffirmed)

Forecasting, what-if scenarios, and AI-generated narrative are all deliberately excluded — the
first because the only available baseline carries no information about the branches it is assigned
to, the others because the deterministic base has to be provably correct before a probabilistic
layer sits on top of it. Authentication, write-back, mobile phone widths, and configurable exports
remain out of scope.
