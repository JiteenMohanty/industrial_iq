import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A data-storytelling annotation: one sentence that states what a figure *means*, placed beside
 * the figure itself.
 *
 * This is the component the brief's storytelling requirement actually hangs on — the difference
 * between showing "Branch A — 14% conversion" and telling the reader that Branch A has the group's
 * highest lead volume and one of its lowest conversion rates. Every string passed in is written by
 * the page from figures the analytics layer computed on that same render; nothing here is
 * generated, templated from a model, or hardcoded.
 */
export function Callout({
  tone = "neutral",
  label,
  children,
  href,
  linkText = "See the evidence",
}: {
  tone?: "neutral" | "critical" | "good" | "accent";
  label?: string;
  children: ReactNode;
  href?: string;
  linkText?: string;
}) {
  const styles = {
    neutral: "border-border bg-raised",
    critical: "border-critical/30 bg-critical-soft",
    good: "border-good/30 bg-good-soft",
    accent: "border-accent/30 bg-accent-soft",
  }[tone];

  return (
    <div className={`rounded-[var(--radius-card)] border ${styles} px-4 py-3`}>
      {label && (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
          {label}
        </p>
      )}
      <div className="text-sm leading-relaxed text-ink-primary">{children}</div>
      {href && (
        <Link
          href={href}
          className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
        >
          {linkText} →
        </Link>
      )}
    </div>
  );
}

/**
 * Inline emphasis for a figure inside prose. Keeps numbers visually separable from the sentence
 * around them without resorting to colour, which is reserved for status.
 */
export function Figure({ children }: { children: ReactNode }) {
  return <strong className="font-semibold tabular-nums text-ink-primary">{children}</strong>;
}
