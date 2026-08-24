# Feature Specification: Dealership Performance Dashboard (DealerPulse)

**Feature Branch**: `001-dealership-performance-dashboard`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Build the feature spec from @plan.md. Cover only the "what" and "why" — user-facing behavior, scope, success criteria. Do not include tech stack or implementation details (those belong in /plan). Flag anything in plan.md that's ambiguous or underspecified as [NEEDS CLARIFICATION]."

## Why This Exists

A dealership group operating five branches has seven months of sales history — leads, reps,
targets, and deliveries — and no way to see what it means. The group is growing (deliveries
climbing month over month), but that growth is masking two expensive problems: one branch is
failing to contact nearly half the leads it receives, and a large block of placed orders has
never been delivered.

The people who need to see this are the group CEO and the branch managers. Today they cannot,
because the answers are buried in a data file. This feature exists to surface those answers and
make each one clickable down to the individual records behind it, so a manager can leave the
screen knowing which specific leads to work today.

The product is judged on Product Thinking (30%), Design & UX (25%), Technical Quality (25%), and
Insight & Storytelling (20%).

## Clarifications

### Session 2026-08-24

Resolved directly from `plan.md` (not asked):

- Q: Which time-range presets are offered? → A: Last 30 days, last 90 days, each month Jun–Dec
  2025, full range, custom (`plan.md` §4.3)
- Q: What severity levels does a detected problem carry? → A: Critical, warning, info
  (`plan.md` §4.4)

Resolved earlier this session during `/speckit-specify`:

- Q: What concrete thresholds fire each detection rule, and what minimum sample excludes an
  entity? → A: Fixed absolute thresholds; see the FR-011 table
- Q: What does "act" mean in the Action Center — is any state change expected? → A: Read-only,
  plus a per-alert call list of the evidence set

Asked and answered this session:

- Q: When a reader filters to a single branch, should the alert feed narrow to that branch or keep
  showing the whole group? → A: Narrow to the selected branch; time range still ignored
- Q: In what form does a manager receive an alert's call list? → A: Downloadable
  spreadsheet-compatible file (CSV) of that alert's evidence set
- Q: How many problems does the landing feed show before the reader asks for more? → A: Top 5,
  remainder behind a single "show all" control
- Q: What accessibility standard must the product meet? → A: WCAG 2.1 Level AA

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cold-open triage: what is going wrong right now (Priority: P1)

The CEO opens the dashboard having never seen it before, with no filters set and no idea what to
look for. Within seconds the screen tells them the group's headline position — units delivered,
revenue, conversion rate, open pipeline value, target attainment — and then hands them a ranked
feed of specific, quantified problems. The top item is not a chart; it is a sentence naming a
branch, stating what is wrong, and attaching a rupee figure to it. Clicking it takes them to the
evidence.

**Why this priority**: This is the product. Everything else is a drill-down from here. If a
reviewer or a CEO opens the page and cannot tell within half a minute that Lakeside Toyota is
failing at first contact, the feature has not delivered its value regardless of what else works.
It is also the only story that stands alone as a viable product on its own.

**Independent Test**: Open the dashboard with no filters applied and no prior knowledge. Verify
the headline figures are present with period-over-period deltas, that a ranked problem feed is
the visual anchor of the page, that the highest-ranked item concerns the branch with the worst
contact coverage, and that clicking it lands on the supporting records.

**Acceptance Scenarios**:

1. **Given** a cold open with no filters, **When** the overview loads, **Then** the top 5 ranked
   problems are visible without scrolling, ordered by severity and then by rupee impact, with the
   number of further problems stated and reachable through a single control.
2. **Given** the ranked feed, **When** the reader looks at the top item, **Then** it names a
   specific entity (branch, rep, or lead group), states the problem in plain English, and shows
   the money at stake.
3. **Given** any item in the feed, **When** the reader clicks it, **Then** they land on the view
   containing the underlying records, with the active filter state preserved.
4. **Given** any item in the feed, **When** the reader asks for its call list, **Then** a
   spreadsheet-compatible file downloads containing one row per record behind that alert, each
   carrying the figure that qualified it, ready to open and work through.
5. **Given** the overview, **When** the reader looks at any headline metric, **Then** it shows a
   change versus the prior comparable period, with the direction and the comparison basis stated.
6. **Given** target attainment is displayed, **When** the reader sees the figure, **Then** an
   explicit data-quality note states that the official targets appear set far above actual
   capacity, so the number is not read as a performance failure.

---

### User Story 2 - Recover the money stuck in undelivered orders (Priority: P2)

A branch manager needs to know which customers have placed an order and never received a car.
They open a dedicated view listing every order that has been sitting undelivered, ranked so that
the oldest and largest sit at the top, with the total value locked up shown as a single number.
The same view tells them why deliveries are slipping — which delay reasons dominate, how long
delivery actually takes, and which branches are worst.

**Why this priority**: This is the largest single recoverable sum in the dataset and the most
directly actionable finding — each row is a customer who can be called today. It is second only
because the triage feed is what makes it discoverable.

**Independent Test**: Open the deliveries view directly. Verify it lists undelivered placed
orders ranked by a combination of age and value, shows the aggregate value at risk, breaks down
delay reasons, and shows delivery-time distribution and per-branch delivery performance.

**Acceptance Scenarios**:

1. **Given** the deliveries view, **When** it loads, **Then** the total value of orders placed but
   never delivered is displayed as a headline figure.
2. **Given** the stuck-order list, **When** the reader scans it, **Then** rows are ranked by age
   combined with value, and each row shows how long it has been stuck.
3. **Given** the delay analysis, **When** the reader reads it, **Then** the dominant reasons for
   delivery delay are shown with their relative weight.
4. **Given** any stuck order, **When** the reader clicks it, **Then** the full history of that
   lead is shown.

---

### User Story 3 - Find where the funnel leaks (Priority: P3)

An operations lead wants to know at which stage the group loses customers, and whether a given
branch leaks in the same place as everyone else or somewhere different. They open a funnel view
showing every stage from new lead to delivery with the drop-off at each step, then overlay a
single branch on top of the group shape to see divergence immediately. Alongside it they see how
long customers sit at each stage, why leads are lost, and which acquisition channels actually
convert.

**Why this priority**: This is the diagnostic layer that explains the alerts. It converts "this
branch is bad" into "this branch is bad *here*". Valuable, but a manager can act on stories 1 and
2 without it.

**Independent Test**: Open the funnel view. Verify the full group funnel renders with per-stage
counts and drop-off percentages, that a branch can be overlaid for comparison, and that lost
reasons and channel conversion rates are shown.

**Acceptance Scenarios**:

1. **Given** the funnel view, **When** it loads, **Then** every stage from new lead through
   delivery is shown with its count and the percentage lost at that step.
2. **Given** the group funnel, **When** the reader selects a branch to overlay, **Then** that
   branch's shape is shown against the group's so divergence is visible without arithmetic.
3. **Given** the funnel view, **When** the reader looks beside it, **Then** the reasons leads are
   lost and the conversion rate by acquisition channel are shown.
4. **Given** stage durations, **When** the reader reads them, **Then** the typical time spent at
   each stage is shown so slow stages are distinguishable from leaky ones.

---

### User Story 4 - Compare branches, then drill to the individual (Priority: P4)

The CEO wants to rank the five branches against each other on the metrics that matter, then open
one branch to see its own numbers, its own funnel against the group, its own alerts, and the reps
working there. From a rep they reach that rep's assigned leads and how long each has been sitting.
From a lead they reach its complete stage-by-stage history.

**Why this priority**: Rep-level drill-down is a hard requirement of the brief, and branch
comparison is how a group-level leader allocates attention. It ranks below the diagnostic views
because it answers "who" rather than "what is wrong".

**Independent Test**: Open the branch comparison, select a branch, then a rep within it, then a
lead. Verify each level shows metrics scoped to that entity and that the lead detail shows the
full stage history.

**Acceptance Scenarios**:

1. **Given** the branch comparison, **When** it loads, **Then** all branches are shown side by
   side on comparable metrics with their recent trend.
2. **Given** a branch is selected, **When** its detail loads, **Then** it shows that branch's
   headline metrics, its funnel against the group's, its own alerts, and its reps.
3. **Given** a rep is selected, **When** their detail loads, **Then** it shows their metrics,
   their funnel, and their assigned leads with how long each has been open.
4. **Given** any lead anywhere in the product, **When** it is opened, **Then** its complete stage
   history is shown as a chronological timeline.

---

### User Story 5 - Scope the view to a period, and share exactly what you are looking at (Priority: P5)

Any reader can narrow every view to a time window — a rolling recent period, a specific month, the
full history, or a custom range — and can also narrow to a single branch. Whatever they are
looking at, the address of the page reproduces it exactly for someone else. The screen always
states how current the underlying data is, so nobody mistakes a historical dataset for live
numbers.

**Why this priority**: Cross-cutting capability that makes the other four stories usable and
shareable. It ranks last because each other story delivers value at the default full-range view
without it.

**Independent Test**: Change the time range and the branch selection on each view, confirm every
figure recomputes, copy the page address into a fresh session, and confirm the identical view and
identical figures appear.

**Acceptance Scenarios**:

1. **Given** any view, **When** the reader changes the time range or branch, **Then** every figure
   and chart on that view recomputes to match.
2. **Given** a filtered view, **When** the reader copies the page address and opens it elsewhere,
   **Then** the same filters and the same figures are reproduced.
3. **Given** any view, **When** it loads, **Then** the date the data runs to is stated, along with
   how far behind the present day that is.
4. **Given** a filter combination that matches no records, **When** the view loads, **Then** a
   clear "nothing here" state explains the situation instead of showing an error or blank charts.
5. **Given** alerts are displayed, **When** a time range is applied, **Then** the alerts still
   reflect the current open state of the business rather than being restricted to the window.
6. **Given** alerts are displayed, **When** a branch is selected, **Then** only that branch's
   problems remain, and any problem measuring it against the group still shows the group figure it
   is compared to.
7. **Given** a branch with no detected problems, **When** it is selected, **Then** the feed states
   that this branch has no detected problems rather than rendering an empty region.

---

### Edge Cases

- **Filtered to zero**: a valid range or branch selection that matches no records must produce an
  explanatory empty state on every view, not an error, a blank chart, or a division-by-zero figure.
- **Range partially or wholly outside the data**: a custom range extending beyond the last date in
  the data, or falling entirely before the first, must be handled without misleading totals.
- **Prior period does not exist**: when the selected window has no comparable preceding window
  inside the data, the delta must be suppressed or explicitly marked as unavailable rather than
  shown against a partial period.
- **Leads that never progressed**: leads whose history contains only the initial state must still
  appear correctly in the funnel, in aging, and in the never-contacted alert.
- **Order placed with no delivery record**: must be counted as stuck rather than dropped from
  totals or double-counted as delivered.
- **Divisor of zero**: a branch, rep, or channel with no leads in the window must not produce an
  infinite or nonsensical conversion rate.
- **Low-volume entities**: a rep or channel with a handful of records must not surface as a
  headline outlier on the strength of a tiny sample.
- **Missing targets**: a branch-month with no target set must not be silently treated as a target
  of zero when attainment is calculated.
- **Unknown identifier in the address**: a branch or rep that does not exist must produce a clear
  not-found state.
- **Data refresh**: if the underlying data is replaced with a later extract, every age, pacing,
  and freshness figure must move with it automatically rather than staying pinned to the old
  period.

## Requirements *(mandatory)*

### Functional Requirements

**Headline position**

- **FR-001**: System MUST present group-level headline metrics covering units delivered, revenue
  delivered, overall conversion rate, open pipeline value, and target attainment.
- **FR-002**: System MUST accompany each headline metric with its change versus the prior
  comparable period, stating the direction and the basis of comparison.
- **FR-003**: System MUST display target attainment together with an explicit data-quality note
  that the official targets appear set at roughly seven times demonstrated capacity, and MUST NOT
  substitute an invented or rescaled baseline in its place.
- **FR-004**: System MUST show the delivery and lead trend over the covered months so the reader
  can see direction of travel, not only a point-in-time total.

**Problem detection and ranking**

- **FR-005**: System MUST automatically detect and surface the following classes of problem:
  leads that were never contacted, whether still open or already lost as a direct result;
  branches whose contact rate falls below the group norm;
  orders placed and left undelivered beyond the normal delivery time; open leads with no recent
  activity; branches whose conversion collapses at a particular funnel stage; reps converting far
  below their branch peers; a loss reason concentrated at one branch; acquisition channels
  consuming meaningful volume at low conversion; and delivery delay reasons concentrated at one
  branch.
- **FR-006**: Each detected problem MUST state a severity of exactly one of **critical**,
  **warning**, or **info**; a plain-English description a non-analyst can act on; the rupee impact
  where money is at stake; and the specific entity involved.
- **FR-007**: System MUST rank detected problems by severity first and rupee impact second, and
  present them as the primary anchor of the landing view.
- **FR-007a**: The landing view MUST show the top 5 ranked problems. Any remaining problems MUST
  be reachable from the feed through a single control that reveals the full ranked list, and the
  count of those not shown MUST be visible so the reader knows more exist. Because FR-007 ranks by
  severity before impact, the five shown are always the most severe; nothing more urgent is ever
  hidden behind the control.
- **FR-008**: Every detected problem MUST link through to the underlying records that produced it.
  A problem that cannot be drilled into MUST NOT be displayed.
- **FR-009**: Problem detection MUST evaluate the current open state of the business regardless of
  the time range the reader has selected, so that applying a narrow window never hides an active
  problem.
- **FR-009a**: The branch filter MUST scope the alert feed. When a branch is selected, only
  problems concerning that branch — including its reps, its leads, and its orders — are shown.
  Comparative problems that judge the branch against the group (contact-rate shortfall, funnel
  collapse) remain visible when that branch is the subject, and MUST retain the group figure they
  are measured against so the comparison stays readable in the narrowed view.
- **FR-009b**: Where a branch filter reduces the alert feed to nothing, the view MUST say so
  explicitly — that this branch has no detected problems — rather than rendering an empty region
  that reads as a loading failure.
- **FR-010**: Identical data and identical filters MUST always yield identical problems in an
  identical order.
- **FR-011**: Detection MUST use the fixed absolute thresholds below. Every threshold MUST be
  applied consistently across all views and MUST be stated to the reader wherever a problem is
  raised on the basis of it, so no alert asks to be taken on trust.

  | # | Problem | Fires when | Minimum sample |
  |---|---------|-----------|----------------|
  | 1 | Never-contacted leads | A lead never reached the contacted stage — open or already lost as a direct result. Raised per branch once that branch holds 5 or more such leads | 5 leads |
  | 2 | Branch contact-rate shortfall | A branch contacts fewer than 70% of the leads it received | 15 leads |
  | 3 | Stuck orders | An order was placed 27 or more days ago with no delivery recorded | 1 order |
  | 4 | Cold open leads | An open lead has had no activity for 7 or more days. Severity rises at the 14-day and 30-day marks | 1 lead |
  | 5 | Branch funnel collapse | A branch's conversion at any single stage falls 15 or more percentage points below the group's rate at that same stage | 15 leads |
  | 6 | Rep outlier | A rep's lead-to-delivery conversion falls 15 or more percentage points below their branch's average | 15 leads |
  | 7 | Lost-reason concentration | A single loss reason accounts for 40% or more of one branch's losses | 10 losses |
  | 8 | Channel quality | An acquisition channel converts below 20% while supplying 10% or more of lead volume | 10% volume share |
  | 9 | Delivery delay concentration | A single delay reason accounts for 40% or more of one branch's delayed deliveries | 5 delayed deliveries |

- **FR-011a**: An entity falling below the minimum sample for a given rule MUST be excluded from
  that rule entirely rather than shown with a caveat, so that a rep or channel with a handful of
  records can never surface as a headline outlier.

**Funnel and diagnosis**

- **FR-012**: System MUST present the full lead funnel from new lead through delivery, with the
  count at each stage and the proportion lost between stages.
- **FR-013**: System MUST allow a single branch's funnel to be compared against the group funnel
  in the same view.
- **FR-014**: System MUST show the typical time leads spend at each stage.
- **FR-015**: System MUST break down why leads are lost, and at which stage loss occurs.
- **FR-016**: System MUST show conversion rate by acquisition channel alongside the volume each
  channel contributes.
- **FR-017**: Stage progression MUST be derived from each lead's recorded history of stage
  transitions, so that a lead's furthest-reached stage and its current stage are both available
  and a lead is never mis-staged.

**Delivery operations**

- **FR-018**: System MUST list every order placed but not delivered, ranked by a combination of
  how long it has been outstanding and its value.
- **FR-019**: System MUST display the aggregate value of undelivered placed orders as a headline
  figure.
- **FR-020**: System MUST break down the reasons deliveries are delayed and show the distribution
  of time taken from order to delivery.
- **FR-021**: System MUST compare branches on delivery performance.

**Comparison and drill-down**

- **FR-022**: System MUST present all branches side by side on comparable metrics with their
  recent trend.
- **FR-023**: System MUST provide a per-branch view showing that branch's metrics, its funnel
  against the group, its own detected problems, and its reps.
- **FR-024**: System MUST provide a per-rep view showing that rep's metrics, funnel, and assigned
  leads with the age of each.
- **FR-025**: System MUST provide a lead-level detail showing the complete chronological history
  of that lead's stage transitions. This is the deepest level of drill-down.

**Filtering, scoping, and sharing**

- **FR-026**: Users MUST be able to scope every view by time range. The offered presets are
  exactly: last 30 days, last 90 days, each individual month from June to December 2025, the full
  range, and a custom range. Rolling presets ("last N days") MUST be measured back from the
  latest date present in the data, not from the present day, so they never resolve to an empty
  window.
- **FR-027**: Users MUST be able to scope every view to a single branch.
- **FR-028**: The current filter state MUST be reproducible from the page address alone, such that
  sharing the address reproduces the identical view and identical figures for another reader.
- **FR-029**: Filter state MUST be preserved when the reader follows a drill-through link.
- **FR-030**: The time basis of each metric class MUST be consistent and documented: lead counts
  are scoped by when the lead was created, revenue and units by when delivery occurred, and
  problem detection is not scoped by the selected window at all.

**Honesty and freshness**

- **FR-031**: System MUST state the date the underlying data runs to, and how far behind the
  present day that is, on every view.
- **FR-032**: All age and pacing calculations MUST be measured against the latest date present in
  the data rather than the present day, so that rankings by staleness remain meaningful.
- **FR-033**: System MUST NOT display forecasts, projections, or invented baselines derived from
  the known-unreliable target figures.
- **FR-034**: All monetary figures MUST be presented in Indian lakh and crore notation rather than
  raw digit strings.

**Resilience and presentation**

- **FR-035**: Every view MUST render a meaningful loading state while its figures are being
  prepared, and a clear empty state when the selection matches no records.
- **FR-036**: The product MUST remain fully usable on desktop and tablet widths, with no
  horizontal page scrolling at any supported width.
- **FR-037**: The product MUST conform to WCAG 2.1 Level AA. In particular: text MUST meet a
  contrast ratio of at least 4.5:1 against its background (3:1 for large text and for the
  boundaries of interactive controls); every interactive element MUST be reachable and operable by
  keyboard alone, in a sensible order, with a visible focus indicator; every control and every
  figure MUST carry an accessible name; and no information may be conveyed by colour alone.

**Scope boundaries**

- **FR-038**: The product MUST be read-only with respect to the dealership's records. It MUST NOT
  offer to assign, reassign, contact, or otherwise change the state of any lead, and MUST NOT
  persist any reader-supplied state. "Acting" is satisfied by naming the specific records to work
  and handing them off; the work itself happens in the dealership's own systems.
- **FR-039**: Every detected problem MUST be convertible into a call list, delivered as a
  downloaded spreadsheet-compatible file containing the specific records behind that alert, one
  record per row. Each row MUST identify the record well enough to find the customer in the
  dealership's own system — at minimum its identifier, customer, branch, and assigned rep — and
  MUST carry the figure that put it on the list, such as how long it has been waiting or what it
  is worth.
- **FR-040**: The download MUST be produced without leaving the product, without configuration,
  and without any account or setup step. It MUST be reproducible: the same alert under the same
  filters yields an identical file. The file MUST be named so that its alert and the data's
  coverage date are identifiable without opening it.
- **FR-040a**: The file MUST open correctly in common spreadsheet software with the rupee figures
  intact, and MUST carry a header row naming every column in plain language rather than internal
  field names.
- **FR-041**: Generating a call list MUST NOT alter any figure, alert, or ranking in the product.
  It is a read of the evidence set, not a state change.
- **FR-042**: System MUST NOT depend on any generated or probabilistic narrative for its insights;
  every statement shown to a user MUST be derivable from the data by a fixed rule.

### Key Entities

- **Lead**: A prospective customer. Carries the branch and rep it belongs to, its acquisition
  channel, its value, its current stage, its complete history of stage transitions with
  timestamps, and, where lost, the reason. The history — not the current-stage label alone — is
  the authoritative record of how far the lead progressed.
- **Stage**: A named point in the customer journey from new lead through contacted, test drive,
  negotiation, order placed, to delivered. A lead may also exit as lost from any stage.
- **Branch**: A dealership location. Groups leads, reps, targets, and deliveries, and is the
  primary unit of comparison and accountability.
- **Rep**: A salesperson attached to a branch, to whom leads are assigned.
- **Target**: A units goal set for a branch for a given month. Known to be unreliable in this
  dataset; displayed with a caveat rather than corrected.
- **Delivery**: The completion of an order — when the vehicle reached the customer, how long it
  took from order placement, and where it was delayed, the reason. A placed order with no matching
  delivery is the definition of a stuck order.
- **Insight (detected problem)**: A rule-derived finding about a branch, rep, channel, or group of
  leads. Carries severity, a plain-English description, monetary impact, the entity concerned, a
  link to its drill-down, and the identifiers of the specific records that justify it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader with no prior exposure to the data can identify the worst-performing branch
  and the specific reason it is failing within 30 seconds of opening the product, without using
  search or filters.
- **SC-002**: 100% of displayed problems reach their supporting records in two clicks or fewer,
  with the reader's filter state intact on arrival.
- **SC-003**: Every figure the product publishes matches the verified figures in the source data
  exactly — including the failing branch's contact rate of 58% (46 of 79 leads), the group funnel
  progression of 510 → 391 → 300 → 235 → 198 → 160, the 38 undelivered placed orders totalling
  ₹8.59 Cr, and group target attainment of 11.2% by units (160 delivered against 1,426 target
  units). Note: `plan.md` §2 states attainment as "≈13%", which its own stated inputs contradict
  (160 ÷ 1,426 = 11.2%); the verified figure governs.
- **SC-004**: 100% of monetary figures are rendered in lakh/crore notation; zero raw digit strings
  appear anywhere in the interface.
- **SC-005**: 100% of headline metrics display a change figure that names both its direction and
  the period it is measured against, or explicitly state that no comparison period is available.
- **SC-006**: Zero views produce an error, a blank chart, or a nonsensical figure for any valid
  combination of time range and branch, including combinations matching no records.
- **SC-007**: Every view is reproducible by address alone: opening a shared address in a fresh
  session yields the identical filters and identical figures 100% of the time.
- **SC-008**: The data's coverage date and its distance from the present day are visible on 100%
  of views.
- **SC-009**: The product presents without horizontal page scrolling at 1440px, 1024px, and 768px
  widths.
- **SC-009a**: Every view passes a WCAG 2.1 Level AA audit with zero violations for contrast,
  accessible naming, and keyboard operability; every interactive element on every view is reachable
  and operable by keyboard alone with a visible focus indicator.
- **SC-010**: Repeated loads of the same view with the same filters produce identical problems in
  an identical order, 100% of the time.
- **SC-011**: A reader can move from a group-level headline figure to an individual lead's full
  stage history in four clicks or fewer.
- **SC-012**: A branch manager can produce a same-day call list of specifically named leads —
  never-contacted leads and stuck orders — from any alert in the product, in under a minute and in
  a single action, with no configuration and no transcribing from a raw data file.
- **SC-013**: 100% of detected problems can produce a downloadable call list of the records behind
  them, each listed record carries the figure that qualified it, and the resulting file opens
  correctly in common spreadsheet software on first attempt.

## Out of Scope

- Rep coaching diagnostics beyond basic per-rep performance drill-down. Named as deprioritised in
  the plan; the hard requirement is drill-down, not a coaching product.
- Any generated, probabilistic, or model-derived narrative or recommendation.
- Forecasting, projection, or scenario modelling — particularly against the target figures, which
  are known to be unreliable.
- Authentication, user accounts, and role-based visibility. Every reader sees the whole group.
- Bulk or whole-dataset export, and export from anywhere other than an alert. The only download
  in the product is the per-alert call list in FR-039, scoped to that one alert's evidence set;
  for sharing a view, the shareable address serves the need.
- Configurable exports — choosing columns, formats, or destinations. The call list has one fixed
  shape.
- Any persisted reader state — dismissing, snoozing, acknowledging, or assigning an alert. Nothing
  a reader does survives a page reload, because none of it can reach the dealership's records.
- Mobile phone widths. Desktop and tablet only.
- Editing, ingesting, or writing back to the dealership's records.
- Live or near-live data. The product presents a fixed historical extract and says so.

## Assumptions

- **Single shared view, no roles**: the plan describes a CEO and branch managers as the audience
  but specifies no authentication and no per-branch visibility restriction. Assumed every reader
  sees every branch, and branch managers narrow to their own branch using the ordinary branch
  filter.
- **Prior-period comparison basis**: assumed each delta compares the selected window against the
  immediately preceding window of identical length. Where that preceding window falls outside the
  data's coverage, the delta is suppressed rather than shown against a partial period. The plan
  requires deltas but does not define the comparison window.
- **Detection thresholds are absolute, not adaptive**: the numbers in FR-011 are fixed values,
  chosen against the current data extract — the 27-day stuck-order mark derives from roughly 1.5×
  the observed 18.3-day average order-to-delivery time, and the 70% contact-rate floor sits below
  the 78–82% achieved by four of five branches. They are deliberately readable and stateable to a
  user rather than statistically derived. Consequence: if the underlying data is replaced with a
  materially different extract, these thresholds require review, since they will not re-tune
  themselves.
- **Ranking of stuck orders**: the plan calls for ranking by "age × value" without defining the
  combination. Assumed a straightforward ordering that puts old, high-value orders at the top,
  with both component figures visible in each row so the reader can verify the ordering
  themselves.
- **Problem feed length**: fixed at the top 5 (FR-007a), with the remainder behind a single
  control. Chosen so the feed anchors the overview without displacing the trend chart and branch
  table, which SC-001's thirty-second test depends on.
- **Default view on cold open**: assumed the full data range with no branch filter, since SC-001
  requires the worst-performing branch to be discoverable without any interaction.
- **Interpretation of "conversion rate"** as the proportion of leads created in the window that
  reached delivery, unless a specific stage pair is named.
- **Aggregate figures include lost leads** in their denominators; a lost lead is a lead that was
  received and failed to convert, and excluding it would flatter every rate in the product.
- The underlying data file is complete and internally consistent as supplied; no data cleaning or
  correction is in scope beyond the target-quality caveat.
- The product is reviewed on a modern desktop or tablet browser at the widths named in SC-009.
- **Chart colour and accessibility**: WCAG 2.1 AA's "no information by colour alone" applies to
  charts as much as to controls, so any series or severity distinguished by colour also needs a
  label, direct annotation, or other non-colour cue. This constrains the palette work rather than
  adding a separate deliverable.
