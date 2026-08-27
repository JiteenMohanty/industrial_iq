/**
 * Every verified number from data-model.md §9, computed directly against
 * docs/dealership_data.json during /speckit-plan and re-verified where the source plan.md was
 * wrong (research.md R2, R3). Import from here — never inline a fixture in a spec file
 * (Constitution V).
 */

export const GROUP_FUNNEL = {
  new: 510,
  contacted: 391,
  test_drive: 300,
  negotiation: 235,
  order_placed: 198,
  delivered: 160,
} as const;

export const LAKESIDE_BRANCH_ID = "B3";

export const BRANCH_CONTACT_RATES: Record<string, { contacted: number; total: number; pct: number }> = {
  B1: { contacted: 80, total: 97, pct: 82.5 },
  B2: { contacted: 86, total: 109, pct: 78.9 },
  B3: { contacted: 46, total: 79, pct: 58.2 },
  B4: { contacted: 80, total: 98, pct: 81.6 },
  B5: { contacted: 99, total: 127, pct: 78.0 },
};

export const LAKESIDE_DELIVERED_RATE = { delivered: 6, total: 79, pct: 7.6 };
/** All 33 are already `lost` — zero currently-open. See decision-log.md, T034/never-contacted. */
export const LAKESIDE_NEVER_CONTACTED = 33;
export const GROUP_NEVER_CONTACTED_OPEN_ONLY = 5; // verified: rule would never fire if isOpen-gated
export const GROUP_DELIVERED_RATE_PCT = 31.4; // 160 / 510

export const STUCK_ORDERS_ALL = { count: 38, valueRupees: 85_860_000 };
export const STUCK_ORDERS_ALERTING_27D = { count: 25 };
/**
 * Verified against the running codebase (dataset.ts + time.ts's explicit UTC-only date flooring),
 * not the PowerShell scripts used during planning, which turned out to be timezone-unreliable —
 * see decision-log.md. This is the true number: plan.md's original "195" was correct all along.
 */
export const OLDEST_STUCK_ORDER_DAYS = 195;

export const DELIVERED_REVENUE_RUPEES = 388_760_000;

export const TARGET_UNITS_TOTAL = 1426;
export const TARGET_REVENUE_TOTAL_RUPEES = 3_130_141_531;
export const GROUP_ATTAINMENT_UNITS_PCT = 11.2; // 160 / 1426 — NOT 13%, see research.md R2
export const GROUP_ATTAINMENT_REVENUE_PCT = 12.4;

/**
 * Computed strictly from status_history containing an actual "lost" entry — NOT from the raw
 * `status` field. 14 leads carry `status: "lost"` with no "lost" entry anywhere in their
 * status_history (and lost_reason: null on every one); Constitution III requires status_history
 * to win, so these 14 are correctly open, not lost. See decision-log.md.
 */
export const LOSSES_BY_STAGE = {
  new: 112,
  contacted: 75,
  test_drive: 55,
  negotiation: 32,
} as const;
export const TOTAL_LOSSES = 274;
export const RAW_STATUS_LOST_COUNT = 288; // raw field only — do not use for analytics

export const CHANNEL_CONVERSION: Record<string, { delivered: number; total: number; pct: number }> = {
  walk_in: { delivered: 64, total: 140, pct: 45.7 },
  auto_expo: { delivered: 13, total: 43, pct: 30.2 },
  referral: { delivered: 25, total: 83, pct: 30.1 },
  website: { delivered: 28, total: 100, pct: 28.0 },
  phone_enquiry: { delivered: 20, total: 72, pct: 27.8 },
  social_media: { delivered: 10, total: 72, pct: 13.9 },
};
export const SOCIAL_MEDIA_VOLUME_SHARE_PCT = 14.1; // 72 / 510

export const DELIVERIES_BY_MONTH: Record<string, number> = {
  "2025-07": 16,
  "2025-08": 18,
  "2025-09": 24,
  "2025-10": 20,
  "2025-11": 30,
  "2025-12": 52,
};

export const DELIVERY_OPS = {
  avgDays: 18.3,
  minDays: 7,
  maxDays: 39,
  delayedCount: 72,
  totalCount: 160,
};

export const STUCK_BY_BRANCH: Record<string, number> = {
  B5: 12,
  B4: 9,
  B2: 7,
  B1: 6,
  B3: 4,
};

export const DATA_AS_OF_ISO = "2025-12-31T19:10:00.000Z";
export const MIN_CREATED_AT_ISO = "2025-06-01T18:46:00.000Z";

export const OPEN_LEADS_COUNT = 76; // status_history-derived: 510 - 274 true-lost - 160 delivered
export const OPEN_PIPELINE_VALUE_RUPEES = 183_520_000;
export const GROUP_CONVERSION_RATE_PCT = 31.37; // 160 delivered / 510 created, full range

export const TOTAL_LEADS = 510;
export const TOTAL_BRANCHES = 5;
export const TOTAL_REPS = 30;
export const TOTAL_TARGETS = 35;
export const TOTAL_DELIVERIES = 160;

/**
 * Every `branch_manager` (one per branch: SR1/SR8/SR14/SR20/SR25) has zero assigned leads in this
 * extract — only `sales_officer`s receive leads. A real, verified zero-denominator case for
 * `computeRepPerformance`/`computeRepDetail`'s conversionPct: must be `null`, never `NaN`/`0`.
 */
export const REP_WITH_ZERO_LEADS_ID = "SR1";
export const REPS_WITH_ZERO_LEADS_IDS = ["SR1", "SR8", "SR14", "SR20", "SR25"];

/** Highest-delivering rep group-wide — sort-order fixture for computeRepPerformance. */
export const REP_TOP_DELIVERED = {
  id: "SR27",
  name: "Manoj Mehta",
  branchId: "B5",
  leadCount: 33,
  delivered: 12,
  conversionPct: 36.4,
};

// ---------------------------------------------------------------------------------------------
// v2 fixtures — every figure below was recomputed directly against dealership_data.json during
// the second-pass EDA, not carried over from v1 or from any planning document.
//
// Two of them were then corrected a second time, because the EDA and the shipped code disagreed:
// currency figures had been transcribed from a "₹28.61 Cr" style display string (losing rupees to
// rounding), and the promise-reliability figures had been computed with raw millisecond arithmetic
// rather than the UTC date flooring the product actually uses. In both cases the shipped code path
// is authoritative and the fixture was moved to match it, never the reverse.
// ---------------------------------------------------------------------------------------------

/**
 * The central finding: the test drive is an absolute gate. Of the 391 contacted leads, 91 never
 * took a test drive, and ZERO of those 91 were ever delivered. If this fixture ever moves, the
 * product's entire framing needs re-examining before the number is updated.
 */
export const TEST_DRIVE_GATE = {
  contacted: 391,
  testDriven: 300,
  noTestDrive: 91,
  /** The proof. Must stay 0. */
  noTestDriveDelivered: 0,
  noTestDriveValueRupees: 235_520_000,
  testDrivenConversionPct: 53.3,
} as const;

/** Combined pre-test-drive loss: never contacted (119) + contacted-but-not-test-driven (91). */
export const PRE_TEST_DRIVE_LOSS = {
  leads: 210,
  valueRupees: 521_600_000,
  sharePct: 41.2,
} as const;

export const NEVER_CONTACTED_GROUP = { count: 119, valueRupees: 286_080_000 } as const;

/** Test-drive rate of contacted leads, by branch. Only B3 falls below the 70% rule floor. */
export const BRANCH_TEST_DRIVE_RATES: Record<string, number> = {
  B1: 86.3,
  B2: 74.4,
  B3: 58.7,
  B4: 80.0,
  B5: 76.8,
};

/** Model economics. Fortuner: 18.4% of leads, 32.4% of revenue. */
export const MODEL_PERFORMANCE: Record<
  string,
  { leads: number; delivered: number; revenueSharePct: number }
> = {
  Fortuner: { leads: 94, delivered: 30, revenueSharePct: 32.4 },
  "Innova Hycross": { leads: 83, delivered: 28, revenueSharePct: 18.5 },
  Camry: { leads: 35, delivered: 10, revenueSharePct: 13.7 },
  "Innova Crysta": { leads: 53, delivered: 17, revenueSharePct: 10.9 },
  "Urban Cruiser Hyryder": { leads: 104, delivered: 27, revenueSharePct: 10.4 },
  Glanza: { leads: 130, delivered: 44, revenueSharePct: 10.2 },
  Hilux: { leads: 11, delivered: 4, revenueSharePct: 3.8 },
};

export const TOTAL_MODELS = 7;

/** Source efficiency — revenue per lead supplied. Walk-in is 3.3x social media. */
export const SOURCE_REVENUE_PER_LEAD: Record<string, number> = {
  walk_in: 1_143_857,
  auto_expo: 808_605,
  website: 698_600,
  phone_enquiry: 666_111,
  referral: 613_373,
  social_media: 348_889,
};

/** Conversion among contacted leads only — strips neglect out of the "quality" question. */
export const SOURCE_CONVERSION_AMONG_CONTACTED: Record<string, number> = {
  walk_in: 53.3,
  referral: 40.3,
  auto_expo: 39.4,
  website: 37.8,
  phone_enquiry: 37.7,
  social_media: 20.4,
};

/**
 * Promise reliability: delivered date vs the close date quoted to the customer.
 *
 * These figures are derived from the shipped code path (`daysBetween`, which floors both operands
 * to a UTC date), NOT from the exploratory analysis script that preceded it. The two disagreed by
 * one lead: the EDA took a raw millisecond difference and rounded, so a car handed over at 14:00
 * on its promised day counted as a day late. Flooring to the calendar date is the correct
 * comparison — the promise was a date, not an instant — so 84 late is right and the EDA's 85 was
 * wrong. Same class of error as the v1 "oldest stuck order" correction; see DECISIONS.md.
 */
export const PROMISE_RELIABILITY = {
  delivered: 160,
  late: 84,
  latePct: 52.5,
  medianSlipDays: 2,
} as const;

/** Only B5 breaches the 60% late-delivery rule floor — and it is the top-revenue branch. */
export const BRANCH_LATE_PCT: Record<string, number> = {
  B1: 50.0,
  B2: 52.78,
  B3: 50.0,
  B4: 38.71,
  B5: 63.83,
};

/** Median lead -> delivery cycle, the sales-velocity figure (NOT inventory-based ADS). */
export const SALES_CYCLE = { medianDays: 37.7, minDays: 20.7, maxDays: 63.6 } as const;

/** Monthly median cycle stretches as volume grows: 33.1d in July to 42.0d in December. */
export const CYCLE_BY_MONTH_TREND = { firstMonth: "2025-07", lastMonth: "2025-12" } as const;

/** Stuck orders that have gone quiet — 24 of 38 silent for 30+ days, 11 for 90+. */
export const STUCK_ORDER_STALENESS = { silent30Plus: 24, silent90Plus: 11, older180Plus: 3 } as const;
