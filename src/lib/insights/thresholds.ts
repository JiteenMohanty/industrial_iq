/**
 * Fixed absolute thresholds, per spec FR-011. Named constants imported by both rules and tests —
 * never inlined at a call site, so the number that fires an alert is stated in exactly one place.
 */
export const THRESHOLDS = {
  neverContacted: {
    minLeadsToFire: 5,
  },
  contactRate: {
    floorPct: 70,
    minSample: 15,
  },
  stuckOrders: {
    minDays: 27,
  },
  coldLeads: {
    infoDays: 7,
    warningDays: 14,
    criticalDays: 30,
  },
  funnelCollapse: {
    minGapPoints: 15,
    minSample: 15,
  },
  repOutlier: {
    minGapPoints: 15,
    minSample: 15,
  },
  lostReason: {
    concentrationPct: 40,
    minSample: 10,
  },
  channelQuality: {
    conversionCeilingPct: 20,
    minVolumeSharePct: 10,
  },
  delayReason: {
    concentrationPct: 40,
    minSample: 5,
  },
  /**
   * Test-drive gate (v2). 70% of contacted leads, against a group figure of 76.7%. Chosen to sit
   * just below the four healthy branches (74.4-86.3%) so it isolates the genuine outlier rather
   * than flagging normal variation.
   */
  testDriveGate: {
    floorPct: 70,
    minSample: 15,
  },
  /**
   * Promise reliability (v2). Fires above 60% of deliveries missing their quoted date, against a
   * group figure of 53.1% — i.e. materially worse than a group that is already unreliable, not
   * merely imperfect.
   */
  promiseReliability: {
    latePctFloor: 60,
    minSample: 15,
  },
} as const;
