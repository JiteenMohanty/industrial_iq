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
} as const;
