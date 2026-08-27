import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrast is arithmetic, so it is asserted rather than eyeballed.
 *
 * This exists because a live audit of the rendered pages found three real WCAG failures that a
 * structural code review had missed: an active tab at 3.6:1, a heatmap step painted with white
 * text at 3.6:1, and a "no data" placeholder at 3.26:1. A one-off browser check finds those once;
 * a test keeps them fixed. Every pair below is parsed straight out of `globals.css`, so a future
 * palette edit that breaks the floor fails here rather than shipping.
 */

const CSS = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Reads a custom property from a specific block of globals.css. Scoped by block because the same
 * property name is deliberately redefined for the dark theme, and reading the first match would
 * silently test the light value twice.
 */
function readVar(name: string, scope: "light" | "dark"): string {
  // The light ramp lives in `:root {}`, the dark one in `.dark {}`. Match the last block of each
  // kind so the ramp definitions (which appear after @theme) win.
  const blocks = [...CSS.matchAll(/(^|\n)(:root|\.dark)\s*\{([^}]*)\}/g)];
  const wanted = scope === "dark" ? ".dark" : ":root";
  const candidates = blocks.filter((b) => b[2] === wanted).map((b) => b[3] ?? "");
  for (const body of candidates.reverse()) {
    const m = body.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
    if (m?.[1]) return m[1];
  }
  // @theme block holds the base (light) definitions for tokens not repeated in :root.
  const theme = CSS.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const m = theme.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (m?.[1]) return m[1];
  throw new Error(`Could not find ${name} for ${scope} in globals.css`);
}

const TEXT_FLOOR = 4.5;
const MODES = ["light", "dark"] as const;

describe("sequential ramp contrast", () => {
  it.each(MODES)("every heatmap step clears 4.5:1 against its paired ink (%s)", (mode) => {
    for (let i = 0; i <= 7; i++) {
      const bg = readVar(`--color-seq-${i}`, mode);
      const ink = readVar(`--color-seq-ink-${i}`, mode);
      const r = contrastRatio(bg, ink);
      expect(
        r,
        `${mode} step ${i}: ${bg} on ${ink} = ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it.each(MODES)("ramp lightness is monotonic, so magnitude reads as magnitude (%s)", (mode) => {
    const lums = Array.from({ length: 8 }, (_, i) => luminance(readVar(`--color-seq-${i}`, mode)));
    const sorted = [...lums].sort((a, b) => (mode === "light" ? b - a : a - b));
    expect(lums).toEqual(sorted);
  });

  /**
   * The specific hex that forced the dark ramp to be re-stepped. It fails against BOTH inks, so no
   * choice of text colour rescues a cell painted with it — the step itself had to go. Asserted by
   * value so it cannot quietly return.
   */
  it("excludes the step that fails against both inks", () => {
    const offender = "#2a78d6";
    expect(contrastRatio(offender, "#0b0b0b")).toBeLessThan(TEXT_FLOOR);
    expect(contrastRatio(offender, "#ffffff")).toBeLessThan(TEXT_FLOOR);

    const darkRamp = Array.from({ length: 8 }, (_, i) => readVar(`--color-seq-${i}`, "dark"));
    expect(darkRamp).not.toContain(offender);
  });
});

describe("interface text contrast", () => {
  it.each(MODES)("body and secondary ink clear 4.5:1 on every surface (%s)", (mode) => {
    const surfaces = ["--color-page", "--color-surface", "--color-raised"];
    const inks = ["--color-ink-primary", "--color-ink-secondary"];
    for (const s of surfaces) {
      for (const k of inks) {
        const bg = readVar(s, mode);
        const fg = readVar(k, mode);
        const r = contrastRatio(bg, fg);
        expect(r, `${mode} ${k} on ${s} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    }
  });

  it.each(MODES)("status text tokens clear 4.5:1 on their tinted backgrounds (%s)", (mode) => {
    const pairs: [string, string][] = [
      ["--color-critical-ink", "--color-critical-soft"],
      ["--color-warning-ink", "--color-warning-soft"],
      ["--color-good-ink", "--color-good-soft"],
    ];
    for (const [ink, tint] of pairs) {
      const r = contrastRatio(readVar(ink, mode), readVar(tint, mode));
      expect(r, `${mode} ${ink} on ${tint} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it.each(MODES)("status text tokens clear 4.5:1 on the card surface too (%s)", (mode) => {
    for (const ink of ["--color-critical-ink", "--color-warning-ink", "--color-good-ink"]) {
      const r = contrastRatio(readVar(ink, mode), readVar("--color-surface", mode));
      expect(r, `${mode} ${ink} on surface = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  /**
   * The selected-control fill is deliberately NOT themed. Theming it produced a 2.4:1 active tab in
   * dark mode, because what matters here is text-against-fill, not fill-against-surface.
   */
  it("the selected-control fill carries white text at 4.5:1 in both modes", () => {
    const solid = readVar("--color-accent-solid", "light");
    expect(contrastRatio(solid, "#ffffff")).toBeGreaterThanOrEqual(TEXT_FLOOR);
    // Same token in both modes — asserted rather than assumed.
    const darkBlock = CSS.match(/\n\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(darkBlock).not.toMatch(/--color-accent-solid\s*:/);
  });

  it.each(MODES)("muted ink clears the 3:1 non-text floor on every surface (%s)", (mode) => {
    for (const s of ["--color-page", "--color-surface", "--color-raised"]) {
      const r = contrastRatio(readVar("--color-ink-muted", mode), readVar(s, mode));
      expect(r, `${mode} muted on ${s} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
});
