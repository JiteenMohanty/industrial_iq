import type { ReactNode } from "react";
import type { Severity } from "@/lib/data/types";
import { SEVERITY_META } from "@/lib/theme";

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-ink-primary ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Severity is never color-alone: a distinct glyph shape plus the word label carry the meaning;
 * color is reinforcement (dataviz skill's status-role rule; see decision-log T030). The color
 * itself is applied only to the glyph and the tinted background, never to the label text, since
 * `critical`'s hex doesn't clear 4.5:1 text contrast on every surface (FR-037).
 */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <Badge className="border-transparent" >
      <span
        aria-hidden="true"
        style={{ color: meta.color }}
        className="text-[10px] leading-none"
      >
        {meta.glyph}
      </span>
      <span style={{ backgroundColor: `${meta.color}22` }} className="rounded-full px-1.5 py-0.5">
        {meta.label}
      </span>
    </Badge>
  );
}
