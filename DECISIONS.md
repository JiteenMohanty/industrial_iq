# Decisions

DealerPulse v2. This is the reviewer-facing narrative: what the product is, the analysis that
shaped it, the choices and tradeoffs behind it, what the data turned out to be hiding, and what
would come next.

This is a **second submission**. The first one worked, and it answered its question correctly — but
it answered the wrong question, and it claimed verification it had not actually performed. Both are
addressed below, plainly, because the difference between the two versions is the most useful thing
I can show you.

The working record lives alongside this: [`docs/decisions/decision-log.md`](./docs/decisions/decision-log.md)
(chronological), [`docs/decisions/architecture-decisions.md`](./docs/decisions/architecture-decisions.md)
(ADRs), and [`specs/002-gate-first-dashboard/`](./specs/002-gate-first-dashboard/) (the spec, plan
and task list this build was executed against).

---

## What I built, and why this shape

**The finding that decided everything.** The funnel in this dataset is strictly sequential — across
all 510 leads, not one skips a stage — and the test drive is an **absolute gate**. Of the 391 leads
that were contacted, 91 never took a test drive. Zero of those 91 reached negotiation, an order, or
a delivery. Not a low rate. Zero.

Put that beside the 119 leads nobody ever contacted and the shape of the business appears:

| Gate | Entered | Passed | Lost | Value lost |
|---|---:|---:|---:|---:|
| Contact | 510 | 391 | 119 | ₹28.61 Cr |
| Test drive | 391 | 300 | 91 | ₹23.55 Cr |
| Close | 300 | 160 | 140 | ₹32.65 Cr |

**210 leads — 41.2% of everything received, carrying ₹52.16 Cr — died before a customer ever sat in
a car.** And because no lead has ever been delivered without a test drive, those are not weak
opportunities awaiting a better closer. They are closed. The two gates fix the size of the pool
that every downstream skill competes over.

So the product leads with the gates and treats conversion, revenue, and rep performance as
consequences of them. That is the whole design thesis, and it is why v2 is not a re-skin: v1 showed
a six-stage funnel where every step looked like a probabilistic conversion, which is a different
and less true story.

### The sections, and the question each answers

| Route | Question |
|---|---|
| **Overview** | What is our position, where is the business being lost, and what do I do today? |
| **Funnel** | Which gate leaks, for the group and for any one branch? |
| **Demand** | What do customers actually want, where, and are we converting that interest? |
| **Sources** | What is each acquisition channel worth per lead it supplies? |
| **Branches** | Who is ahead, who is behind, and on which specific metric? |
| **Reps** | Who carries volume without converting it, and who converts well on a light book? |
| **Deliveries** | What is stuck, why, and do we keep the dates we promise? |
| **Leads** | Show me the actual records behind any number on any screen. |

Layered deliberately: position (10 seconds) → diagnosis (a minute) → cause (a few minutes) →
records. Nothing is nested — every section is one click from every other, because a manager chasing
a problem should not have to remember which parent a view lives under.

---

## What was wrong with the first version

The audit that started this rebuild found nine things. The five that mattered:

**1. The alert feed repeated itself.** Ranking was a strict total order — severity, then rupee
impact — and the landing feed showed its top five. On this dataset that produced four instances of
the *same rule* at four different branches. Technically the five most severe items; nearly useless
as a summary of what is wrong with the business.

*Fixed by separating ranking from selection.* `runInsights()` still returns the strict total order —
the CSV endpoint and the determinism guarantee both need it. `selectHeadlines()` then picks
round-robin across rules, so the five slots spend themselves on five different problems. The
cold-open feed now spans contact rate, never-contacted, the test-drive gate, cold leads, and stuck
orders, across four branches.

**2. "View evidence" did not reach the evidence.** An alert claiming 33 never-contacted leads
linked to the branch page — which showed that branch's metrics, funnel, alerts and reps, and never
listed the 33 leads. The CSV download was the only real path to them. The product's central claim
about being actionable had a dead end in the middle of it.

*Fixed by building the view that was missing.* Every rule now carries two links — one to the entity
it concerns, one to the exact records it counted — plus a fixed, rule-authored action line. The new
lead explorer shares the detection scope exactly (branch-filtered, never time-filtered), so a list
opened from an alert can never contain fewer records than the alert just claimed.

**3. A quarter of the dataset was never analysed.** `model_interested` was unused. So was
`expected_close_date`. Two whole analytical dimensions, both of which turned out to carry findings
the rest of the dashboard could not see.

**4. Verification was claimed, not performed.** v1's task list recorded the responsive and
accessibility passes as *"verified by structural code review"* — reading the source and concluding
it looked right. I measured the same pages this time. That found a 199px horizontal overflow at
768px and three genuine WCAG contrast failures, including one colour that fails against *both*
black and white text and therefore could not have been fixed by any choice of ink. Every one of
them was invisible to a careful reading of the source.

This is the correction I'd most want you to weigh, because it is a process failure rather than a
coding one. The constitution now carries it as a principle: *Verified By Measurement, Not By Code
Review*, and contrast is a test suite rather than a one-off check.

**5. Every route shipped the chart library.** ~210 kB first load on pages where nothing was
interactive.

*Fixed by rendering charts on the server.* The gate funnel, stage funnel, ranked bars,
distributions, sparklines and the heatmap are HTML/CSS or inline SVG with native tooltips — real
hover behaviour, zero JavaScript. Recharts survives only where a crosshair over a time series or a
scatter tooltip genuinely earns its weight. Seven of nine routes dropped from ~210 kB to ~106 kB.

---

## Key product decisions and tradeoffs

**Gates over stages, as the primary frame.** The tradeoff is that a six-stage funnel is the
conventional view and some readers arrive expecting it. It is still there, on the funnel page, with
per-stage conversion and a branch overlay. But it is the second thing, not the first, because
three gates with money attached is what a manager can act on and six stages with percentages is
what a manager has to interpret.

**The alert feed optimises for coverage, not for strict severity order.** A reader who wants the
literal ranking clicks through to it. I judged that a feed showing five different *kinds* of
problem is worth more on a cold open than one showing the five worst instances, which on this data
means one problem repeated. That is a genuine tradeoff and I would defend it, but it is a choice.

**Status marks distinguish "level with the group" from "not rated".** These started as four states
where a single dash meant both "the sample is too small to judge" and "within a few points of the
group". On the rep table that put ten of twenty-five officers under one label — five genuinely
unmeasured, five sitting at or slightly *ahead*. The worst contact rate in the group showed the same
dash as a rep performing fine, because his book was three leads short of the floor. A mark reading
"no reading" while quietly meaning "fine, actually" is worse than no mark: it reads as a claim.
Five states now, contiguous and symmetric around the group figure, and every mark carries a tooltip
naming the gap, the figure it was measured against, and the sample it rests on.

**Status marks are always relative to the group's own figure, never an industry benchmark.** This
dataset supplies no external baseline. Inventing a "good" contact rate would make every ▲ and ▼
unfalsifiable. So every judgement is "ahead of / behind *this group*", and the group figure is
printed beside it. Entities below 15 leads get no mark at all rather than a caveated one — a rep
with nine leads is not "underperforming", they are unmeasured.

**No page-level loading skeletons — a measured decision, not an omission.** The obvious way to show
a route is working is a skeleton. Measured here, that skeleton stands 808px tall against 2083px of
real content, so swapping it in on a parameter change collapses the document and the *browser*
clamps the reader's scroll position: 1363px of available scroll becomes 88px. At a 16-160 ms server
response the fallback bought nothing and cost the reader their place on every interaction, so it is
gone and Next simply keeps the current page rendered until the new payload arrives. The one
remaining fallback is the filter bar's, which is height-matched to the control row it replaces.

**The URL is the only view state — which had one cost, now paid.** Every control writes to the URL,
which is what makes each view shareable by address. But it means Next.js cannot tell "go to the
branch page" from "switch this chart to units": both are link navigations, and its default is to
scroll to the top. Changing a chart measure halfway down a page threw the reader back to the top —
the data updated correctly and the interaction felt broken. The distinction is now drawn in the type
system rather than left to discipline: `ViewLink` for controls that change the current view,
ordinary `Link` for navigation, with a test asserting `scroll={false}` is written in exactly one
file.

**Two peaks, not one, on the demand view.** Enquiries peak in November and deliveries peak in
December — one month apart, which is what the 38-day median sales cycle predicts. Reported
separately because a dealership planning stock needs the delivery peak while one planning contact
and test-drive capacity needs the enquiry peak, and collapsing them into "our best month" hides
which is which. The festive-season reading is stated as a *quarter* effect: Diwali fell on 20
October 2025, inside the enquiry peak, but weekly volume is broadly elevated across October and
November rather than spiking in any single week — so the page names the festival as context external
to the dataset and does not claim it as a cause.

**Three things are deliberately not computed, and say so on screen.**

- *Average days to sell*, in the classic inventory sense, is not computable — this dataset has no
  inventory or stock records. Rather than quietly substituting something adjacent and calling it
  ADS, the deliveries page states the absence and shows the two honest analogues, each labelled for
  what it actually measures: order-to-delivery (fulfilment, 18.3 days average) and lead-to-delivery
  (sales cycle, 37.7 days median).
- *Cost per lead and channel ROI* are not computable — no acquisition cost exists in the data. The
  sources page ranks channels by revenue *per lead supplied*, states that this is a return figure
  rather than a return-on-spend figure, and says that deciding what to cut needs cost data it does
  not have.
- *Promise reliability carries no rupee impact.* The revenue is already banked; what is at risk is
  repeat business, which this dataset cannot price. The rule returns `null` rather than attaching
  an invented number to a real finding.

**No forecasting, no what-if, no AI narrative.** Carried over from v1 and reaffirmed. Forecasting
has no usable baseline: the targets carry *zero* information about the branches they are assigned
to — every branch was handed 35–45 units a month regardless of size or history, against actual
output of 1.0 to 7.8. Projecting against that produces an authoritative-looking number that means
nothing. The other two wait on the same principle: the deterministic layer has to be provably
correct before a probabilistic one sits on top of it.

**One axis, always.** The trend chart switches measure through a URL control rather than plotting
revenue and cycle time on two scales. Two measures of different magnitude on one plot invite the
reader to see a relationship the axes invented.

**Every view has a stated filter scope, and the filter bar only shows what applies.** A global
control that silently does nothing is worse than no control, so each analytics function has a
deliberate answer to "does this respond to branch, and to time":

| Scope | Applies to | Rule |
|---|---|---|
| Branch **and** time | KPIs, funnel, demand, sources, reps, delivery operations | Population views — "what did this branch's customers want in November" is a real question |
| Branch only | Alerts, the gate breakdown, stuck orders, the lead explorer | Present-tense state. A live problem must not vanish because someone picked "last 30 days" (FR-009), and the lead explorer must match the alert scope exactly or an evidence link would show fewer rows than its alert claimed |
| Time only | Cross-branch comparison tables | They exist to rank every branch; narrowing to one row removes the only thing they do |

Where a page ignores a filter, the bar says so in a line beside the controls, and the branch
control is hidden entirely on the two single-entity detail pages (which scope from their own URL)
and on the branch comparison. The contract is asserted function by function, in both directions, in
`tests/filters/scope-coverage.spec.ts` — 61 assertions.

This was a defect in my own first pass at v2, not a v1 leftover: nearly every analytics function
read the unfiltered group pool, so the shared Time range / Branch controls were inert on five of
eight pages while still being displayed on all of them. It was caught by a reader trying the
control and noticing nothing moved, which is the cheapest possible bug report and one I should have
run myself.

**Kept what was right.** The v1 data layer — parsing, enrichment, indexing, memoisation, the
`server-only` guard — survives essentially unchanged, as do all nine original detection rules and
their thresholds. The audit found no defect in them. Rewriting correct code to make a rebuild look
more thorough would have been churn.

---

## What the data actually says

The headline finding was visible on a first pass. The patterns below were not. They surfaced on a
second pass, using AI to collapse 510 leads and their nested status histories into small cross-tabs
— contact rate against lead load, step conversion against the group, never-contacted rate against
source, deal value, rep and model. At 510 rows nothing announces itself; at ten rows a shape either
appears or it does not. Several of these sharpen the product's story. One of them corrects it.

### 1. The test drive is a wall, not a step

| Time to first contact | Leads |
|---|---:|
| Under 1 day | 45 |
| 1–2 days | 160 |
| 2–4 days | 186 |
| More than 4 days | **0** |

Not one lead was first contacted later than 3.3 days after it arrived. Follow-up here is binary:
worked inside a three-day window, or abandoned at intake. A conventional "leads aging without
contact" alert — the kind most CRM dashboards ship — would find nothing, because no lead ever ages
into it. The only useful form is the binary one, and the intervention it implies is operational
(something drops leads at assignment) rather than motivational.

### 2. The worst branch is not overwhelmed — it is the least loaded in the group

| Branch | Officers | Leads | Leads/officer | Contact rate | Delivered |
|---|---:|---:|---:|---:|---:|
| **Lakeside** | 5 | 79 | **15.8** | **58.2%** | **6** |
| Downtown | 6 | 97 | 16.2 | 82.5% | 40 |
| Highway | 5 | 109 | 21.8 | 78.9% | 36 |
| Central | 4 | 98 | 24.5 | 81.6% | 31 |
| Eastside | 5 | 127 | 25.4 | 78.0% | 47 |

**Lakeside delivered six cars in seven months** while its peers delivered 31 to 47. It carries the
lightest book in the group and posts the worst contact rate; Eastside carries 60% more leads per
officer and contacts 78% of them. "They are overwhelmed" is not available as an explanation.

Nor is lead quality: Lakeside's source mix is unremarkable, and Central draws 22% of its leads from
social media — the worst-converting channel — while still contacting 81.6% of them. Average deal
value is ₹24.8L at Lakeside against ₹21.6L–₹25.5L elsewhere. Same leads, same money.

What is left is specific people. Two of Lakeside's five officers account for 20 of its 33
never-contacted leads.

### 3. It does not leak at one stage — it leaks at every stage

| Transition | Group | Lakeside | Gap |
|---|---:|---:|---:|
| new → contacted | 76.7% | 58.2% | −18.5pp |
| contacted → test drive | 76.7% | 58.7% | −18.0pp |
| test drive → negotiation | 78.3% | 51.9% | −26.4pp |
| negotiation → order | 84.3% | 71.4% | −12.9pp |
| order → delivered | 80.8% | 60.0% | −20.8pp |

**This one corrects the product.** The funnel-collapse rule reports that *Lakeside's funnel
collapses at negotiation*, because negotiation is the single widest gap. That framing is imprecise
and the branch page now says so: there is no collapse point. Lakeside converts 13 to 26 points below
the group at every one of five transitions. A single-stage collapse implies a training gap at one
skill; a uniform shortfall across the whole journey points at how the branch is run. The rule does
what it was specified to do — find the worst stage — but the honest diagnosis is the one the whole
table gives.

### 4. Revenue is a mix problem, not only a conversion problem

| Model | Leads | Share of leads | Revenue | Share of revenue |
|---|---:|---:|---:|---:|
| Fortuner | 94 | 18.4% | ₹12.61 Cr | **32.4%** |
| Innova Hycross | 83 | 16.3% | ₹7.19 Cr | 18.5% |
| Camry | 35 | 6.9% | ₹5.34 Cr | 13.7% |
| Glanza | 130 | **25.5%** | ₹3.97 Cr | 10.2% |

Two models carry 51% of revenue. Glanza is a quarter of all demand and a tenth of the money. A
point of conversion is worth roughly three times more on a Fortuner lead than on a Glanza lead —
which means "improve conversion" is not one instruction, and a dashboard that counts only units
cannot see that. v1 never looked at this field.

### 5. Channel "quality" is largely a test-drive-rate story wearing a different name

| Source | Leads | Raw conversion | Among contacted | Test-drive rate | Revenue/lead |
|---|---:|---:|---:|---:|---:|
| Walk-in | 140 | 45.7% | 53.3% | 90.0% | ₹11.44 L |
| Auto expo | 43 | 30.2% | 39.4% | 72.7% | ₹8.09 L |
| Website | 100 | 28.0% | 37.8% | 70.3% | ₹6.99 L |
| Referral | 83 | 30.1% | 40.3% | 75.8% | ₹6.13 L |
| Phone enquiry | 72 | 27.8% | 37.7% | 75.5% | ₹6.66 L |
| **Social media** | 72 | **13.9%** | **20.4%** | **59.2%** | **₹3.49 L** |

Raw conversion conflates two different failures — leads nobody worked, and leads that were worked
and were never going to buy. The gap between columns 3 and 4 is neglect; what remains is genuine
lead quality. Social media is roughly a third neglect and two thirds quality. Only the first third
is the branch's problem to fix, and the sources page shows both columns side by side for exactly
that reason.

### 6. Reliability does not follow revenue

52.5% of all deliveries missed the close date quoted to the customer. Broken down, the ranking
inverts the revenue ranking: **Eastside is the group's highest earner (₹11.43 Cr) and its least
reliable (63.8% late, typically six days over)**, while Central sells less and beats its quoted date
more often than not (38.7% late, typically four days early). Nothing in a units-and-revenue view
surfaces that, and it is the kind of thing that costs referrals rather than revenue.

### 7. Stuck orders are abandoned, not late

38 undelivered placed orders carry ₹8.59 Cr against a median fulfilment time of 17 days. **24 of the
38 have had no recorded activity for 30 days or more; 11 for over 90; three are older than 180.**
The oldest is 195 days and ₹50.5L. At that age these are not deliveries running behind — they are
deals nobody closed out. A related consequence for reading the overview: 38 of the 76 open leads
*are* these orders, so ₹8.59 Cr of the ₹18.35 Cr open pipeline is not a live pipeline in any useful
sense.

### 8. Value does not drive follow-up priority

Reps work the ₹25–38L band hardest (38.2% conversion, 15.7% never contacted). But the most
expensive leads in the business — ₹39–56L — are ignored at 26.5%, indistinguishable from the
cheapest quintile. No value-based triage is happening anywhere in the group. Of everything here it
is the cheapest to act on, because it is a queueing policy rather than a hiring or training problem.

### 9. The dataset is synthetic, and three detection rules correctly find nothing because of it

Every stage transition has a hard ceiling and effectively no tail — the longest first contact on
record is 3.3 days, the longest negotiation 14.3. Real pipelines are heavily right-skewed. The same
signature appears elsewhere: the eight loss reasons are near-uniform (all between 8.8% and 14.6%),
the delay reasons top out at 25%, and every branch was handed a near-identical monthly target
regardless of its size.

That is the direct explanation for why three of the eleven detection rules — rep outlier,
lost-reason concentration, delivery-delay concentration — return nothing on this extract. It is not
a miscalibration; there is no concentration in the data to find, and the tests assert exactly that
rather than having thresholds lowered until something appeared.

It also bounds a claim the product makes: the 7/14/30-day cold-lead steps and the 27-day
stuck-order mark were calibrated against a distribution with no tail. Against production data they
would fire very differently and would need review.

**One more data-integrity note.** `lost_reason` is not consistent with the stage a lead reached —
leads recorded as "dissatisfied with test drive" include some that never took one. The stage a lead
died at is reliable here; the stated reason is not, and the funnel page says so where the reasons
are displayed. (v1's finding that 14 leads carry `status: "lost"` with no `lost` entry in their
history still stands, and the product still derives every stage from history rather than the flat
field.)

---

## Verification

Every figure in this product and in this document was computed from `dealership_data.json` through
the shipped code path. That discipline caught two of my own errors during this build:

- **A currency total transcribed from a formatted label.** I read ₹28.61 Cr off a display string
  and wrote 286,100,000 into a fixture. The true value is 286,080,000 — the label rounds to two
  decimals. The test failed, and the fixture moved to the code's value rather than the reverse.
- **A date comparison that disagreed with the product's own.** My analysis script computed promise
  slip with raw millisecond arithmetic; the product floors both operands to a UTC date. A car handed
  over at 14:00 on its promised day counted as a day late in the script and on time in the product.
  The product is right — the promise was a date, not an instant — so the late count is 84, not the
  85 my script produced.

Both are the same lesson, and the constitution now carries it: *a fixture must come from the shipped
code path, never from an analysis script or a formatted string.*

**What was measured, not reviewed:**

| Check | Result |
|---|---|
| Test suite | 338 passing across 37 files |
| Production build | Clean, 12 routes, TypeScript strict, no errors |
| Route smoke test | 41 URL variants including malformed params, unknown ids and a zero-result range — rendered output parsed for `NaN`/`Infinity`/`undefined`: none |
| Horizontal overflow | Measured 0px on every route at 1440 / 1024 / 768 — after finding and fixing 199px on `/models` |
| Contrast | 14 assertions over every token pair in both themes, in `tests/design/contrast.spec.ts` — after finding and fixing three real failures |
| Client payload | Dataset absent from every chunk; seven of nine routes at ~106 kB |
| CSV endpoint | Correct row count, UTF-8 BOM, filename, 400 and 404 paths |

---

## Known limitations

- **Not-found pages return HTTP 200.** `/branches/{unknown}` and `/reps/{unknown}` render the
  correct not-found content (verified in the browser; `noindex` present, confirming Next's
  `notFound()` engaged), but the status code does not reflect it on these dynamically-rendered
  routes. A known Next.js App Router limitation; carried over from v1 and still unresolved.
- **The accessibility audit was hand-written, not a full ruleset.** It covers contrast, accessible
  naming, heading order, duplicate ids and overflow, and it found real defects — but it is not
  axe-core, and a keyboard traversal pass by a person has not been done.
- **Conversion for a recently-created cohort is right-censored.** Lead counts are scoped by
  creation date and the median lead-to-delivery journey runs 37.7 days, so selecting December 2025
  shows a conversion rate of 1.3% against 27–43% for June through November — arithmetically correct
  and materially misleading. `computeGateTrend` marks which monthly cohorts are mature, but the
  overview's KPI tiles do not yet carry that warning.
- **The branch filter is inert on single-entity detail pages.** `/branches/[id]` and `/reps/[id]`
  scope themselves from their own path and ignore the shared `?branch=` control.
- **The heatmap's hover detail uses native `title` tooltips.** Zero JavaScript and keyboard- and
  screen-reader-accessible, but the appearance delay is the browser's and cannot be styled.
- **The "branch with no detected problems" empty state has no real case here.** All five branches
  have genuine alerts, so that path is exercised by code inspection only.
- **Thresholds are tuned to this extract.** Stated above; they would need review against production
  data with real long tails.

---

## What I'd build next

Everything here is deterministic by design: eleven fixed rules, pure functions, byte-identical
output for a given dataset and filter set. That is a sequencing decision rather than a position on
AI — the ban on a probabilistic insight path and the refusal to forecast against the targets both
protect the same property, that every rupee figure on screen traces to a rule you can check. With
that base built and tested, the next tier is the generative one, layered **on top of** the verified
numbers rather than in place of them.

**Forecasting — against demonstrated capacity, not against the targets.** Project each branch's own
trailing run-rate and current pipeline composition forward, and report the official target
alongside as the fiction it is rather than using it as the denominator.

**What-if on the gates.** The step-conversion table is already the input a scenario tool needs.
*If Lakeside contacted its leads at the group's rate, what is that worth?* is answerable from
figures the product computes today: lifting 58.2% to 76.7% puts roughly 15 more leads into the
funnel, which at the group's 40.9% contacted-to-delivered rate and Lakeside's ₹24.8L average deal
is about **₹1.5 Cr**. Turning that from arithmetic into a control moves the Action Center from a
diagnosis to an argument with a number attached.

**AI narration over verified numbers.** The model receives the computed `Insight` objects —
severity, entity, rupee impact, evidence ids — and turns them into prose. It never reads the
dataset and never originates a figure. That preserves what this build was designed around while
removing the one thing the Action Center genuinely lacks: a paragraph a CEO can read without
parsing eleven cards.

**Four smaller things, each surfaced by this build:**

- **A cohort-maturity warning on recent windows.** `computeGateTrend` already computes it; the KPI
  tiles do not yet use it. December currently reads as catastrophic for a reason that is arithmetic
  rather than commercial.
- **Per-rep gate alerts.** The rep-outlier rule measures delivery conversion, where Lakeside's
  officers are uniformly poor, so it correctly returns nothing. Measured on *contact rate* it would
  fire immediately on the two people behind 20 of that branch's 33 never-contacted leads — turning
  a branch-level alert into a named, coachable one. Roughly twenty lines against the existing rule
  interface.
- **Value-weighted lead routing.** Finding 8 says the most expensive leads are neglected as often
  as the cheapest. A queue ordered by deal value, surfaced as a daily list, is a policy change
  rather than a product one — but the product is where you would see whether it worked.
- **A real automated accessibility audit and a human keyboard pass**, to close the last gap between
  what has been measured here and what "verified" should mean.
