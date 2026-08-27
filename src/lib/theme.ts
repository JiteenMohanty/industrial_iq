import type { Severity } from "@/lib/data/types";
import type { PerfStatus } from "@/lib/analytics/benchmark";

/**
 * Design tokens as plain values, mirroring the CSS custom properties in globals.css.
 *
 * Needed here as well as in CSS because Recharts takes literal colour strings for fill/stroke —
 * `var()` is not reliable across every primitive. Everything else in the UI re-themes purely
 * through the `.dark` custom-property overrides, so this file is deliberately small and is the
 * only place a hex is duplicated.
 *
 * Values come from the dataviz skill's validated reference palette. The three-slot categorical
 * subset used by every multi-series chart here was re-run through the validator against this
 * product's own surfaces (all-pairs: worst CVD ΔE 9.2, worst normal-vision ΔE 24.0 — both pass).
 */
export const COLOR = {
  accent: { light: "#2a78d6", dark: "#3987e5" },

  /** Fixed and mode-invariant by design — a status colour must mean the same thing in both modes. */
  status: {
    critical: "#d03b3b",
    warning: "#fab219",
    good: "#0ca30c",
    neutral: "#898781",
  },

  ink: {
    primary: { light: "#0b0b0b", dark: "#ffffff" },
    secondary: { light: "#52514e", dark: "#c3c2b7" },
    muted: { light: "#898781", dark: "#928f88" },
  },

  surface: {
    page: { light: "#f7f7f5", dark: "#0c0c0b" },
    card: { light: "#ffffff", dark: "#171716" },
    raised: { light: "#f4f4f1", dark: "#201f1e" },
  },

  grid: { light: "#e6e5df", dark: "#2c2c2a" },
  baseline: { light: "#c3c2b7", dark: "#43423f" },
} as const;

/** Ordered, fixed categorical hues — never cycled, never reused for status. */
export const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
} as const;

/**
 * The eight sequential ramp steps, as indices. The actual colours live in globals.css as
 * `--color-seq-0..7` and their paired inks as `--color-seq-ink-0..7`, so both re-theme atomically
 * with the `.dark` class and the heatmap needs no client-side theme state at all.
 *
 * Each pair was measured against the 4.5:1 text floor rather than chosen by eye. Two findings came
 * out of that pass and are recorded where the values live:
 *   - the ink flip sits between steps 4 and 5 in both modes;
 *   - `#2a78d6` was dropped from the dark ramp entirely, because it fails against *both* inks
 *     (4.46:1 near-black, 4.48:1 white) and so no text colour can rescue a cell painted with it.
 */
export const RAMP_STEPS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Maps a 0–1 intensity onto a ramp index. Null (no leads in the cell) maps to step 0, which reads
 * as "nothing here" and is visually distinct from a genuine low value by its muted ink.
 */
export function rampIndex(intensity: number | null): number {
  if (intensity === null) return 0;
  const last = RAMP_STEPS.length - 1;
  return Math.min(last, Math.max(0, Math.round(intensity * last)));
}

/**
 * Severity is never conveyed by colour alone: each carries a distinct glyph and an explicit word,
 * so the cue survives greyscale, colour-blindness, and forced-colors mode. Severity colour is
 * applied to icons, borders and background tints only — never to the label text itself.
 */
export const SEVERITY_META: Record<
  Severity,
  { label: string; glyph: string; order: number; tint: string; ink: string }
> = {
  critical: {
    label: "Critical",
    glyph: "▲",
    order: 0,
    tint: "bg-critical-soft",
    ink: "text-critical-ink",
  },
  warning: {
    label: "Warning",
    glyph: "◆",
    order: 1,
    tint: "bg-warning-soft",
    ink: "text-warning-ink",
  },
  info: { label: "Info", glyph: "●", order: 2, tint: "bg-raised", ink: "text-ink-secondary" },
};

/** Traffic-light meta for benchmark tables — same no-colour-alone rule as severity. */
export const STATUS_META: Record<
  PerfStatus,
  { label: string; glyph: string; dot: string; ink: string }
> = {
  good: { label: "Ahead of group", glyph: "▲", dot: "bg-good", ink: "text-good-ink" },
  warning: { label: "Slightly behind", glyph: "▪", dot: "bg-warning", ink: "text-warning-ink" },
  critical: { label: "Well behind", glyph: "▼", dot: "bg-critical", ink: "text-critical-ink" },
  neutral: { label: "No reading", glyph: "–", dot: "bg-baseline", ink: "text-ink-muted" },
};

/** Resolves the theme-dependent colours Recharts and inline SVG need as literal strings. */
export function chartColors(isDark: boolean) {
  const k = isDark ? "dark" : "light";
  return {
    accent: COLOR.accent[k],
    grid: COLOR.grid[k],
    baseline: COLOR.baseline[k],
    ink: COLOR.ink.primary[k],
    inkSecondary: COLOR.ink.secondary[k],
    muted: COLOR.ink.muted[k],
    surface: COLOR.surface.card[k],
    series: isDark ? SERIES.dark : SERIES.light,
    status: COLOR.status,
  };
}
