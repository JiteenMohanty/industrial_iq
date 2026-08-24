export type TimePreset = "last30" | "last90" | "month" | "full" | "custom";

export interface Filters {
  preset: TimePreset;
  /** Always concrete, including for `full` — no downstream code branches on null. */
  from: Date;
  to: Date;
  /** "YYYY-MM", set only when preset === "month". */
  month: string | null;
  branchId: string | null;
}
