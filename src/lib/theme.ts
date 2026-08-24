import type { Severity } from "@/lib/data/types";

/**
 * Design tokens as plain values, mirroring the CSS custom properties in globals.css. Needed here
 * (not just in CSS) because Recharts fill/stroke props take literal color strings, not CSS
 * variables reliably across all chart primitives. Values come from the dataviz skill's validated
 * reference palette (references/palette.md) — status roles are fixed/mode-invariant by design;
 * the single accent and neutral scale are this product's chosen slots from that palette.
 */
export const COLOR = {
  accent: "#2a78d6",
  accentDark: "#3987e5",

  status: {
    critical: "#d03b3b",
    warning: "#fab219",
    good: "#0ca30c",
  },

  ink: {
    primaryLight: "#0b0b0b",
    primaryDark: "#ffffff",
    secondaryLight: "#52514e",
    secondaryDark: "#c3c2b7",
    mutedLight: "#898781",
    mutedDark: "#898781",
  },

  surface: {
    chartLight: "#fcfcfb",
    chartDark: "#1a1a19",
    pageLight: "#f9f9f7",
    pageDark: "#0d0d0d",
  },

  grid: {
    light: "#e1e0d9",
    dark: "#2c2c2a",
  },
} as const;

/**
 * Severity is never conveyed by color alone (dataviz skill: "status colors... ship with an icon
 * + label, never color alone"). Each severity carries a distinct glyph shape as well as a color
 * and an explicit word label, so the cue survives grayscale printing or color-blindness even
 * before the label is read.
 *
 * Severity color is applied to icons/borders/background tints only — never to the label text
 * itself, which stays in primary ink. `critical`'s status hex is only 3.62:1 against the dark
 * chart surface (documented in the reference palette), clearing the 3:1 UI-boundary floor but not
 * the 4.5:1 text floor — using it for icons/borders/tints, not body text, is what keeps every
 * actual text run compliant with WCAG 2.1 AA (FR-037) regardless of which severity it names.
 */
export const SEVERITY_META: Record<
  Severity,
  { label: string; color: string; glyph: string; order: number }
> = {
  critical: { label: "Critical", color: COLOR.status.critical, glyph: "▲", order: 0 },
  warning: { label: "Warning", color: COLOR.status.warning, glyph: "◆", order: 1 },
  info: { label: "Info", color: COLOR.ink.mutedLight, glyph: "●", order: 2 },
};

/** Ordered, fixed categorical hues for chart series — never cycled, never reused for status. */
export const CATEGORICAL_SERIES = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

/**
 * Resolves the theme-dependent subset of COLOR that Recharts components need as literal strings
 * (stroke/fill props don't reliably take CSS `var()` across every Recharts primitive, unlike plain
 * DOM elements — which is why the rest of the UI re-themes via CSS custom-property overrides in
 * globals.css's `.dark` block, but charts need this instead). Every client chart component calls
 * this once with `useTheme().theme === "dark"` rather than each hand-rolling its own ternaries.
 */
export function getChartColors(isDark: boolean) {
  return {
    accent: isDark ? COLOR.accentDark : COLOR.accent,
    grid: isDark ? COLOR.grid.dark : COLOR.grid.light,
    mutedInk: isDark ? COLOR.ink.mutedDark : COLOR.ink.mutedLight,
  };
}
