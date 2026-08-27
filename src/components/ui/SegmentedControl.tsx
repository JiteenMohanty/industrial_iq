import Link from "next/link";

/**
 * URL-driven tab control — each option is a link, not a client state toggle.
 *
 * Keeps every view of a chart (which heatmap metric, which dimension, which branch overlay)
 * reproducible from the address alone, and keeps the surrounding page a Server Component so the
 * data behind each option never crosses to the client (Constitution I and VI).
 */
export function SegmentedControl({
  options,
  activeKey,
  hrefFor,
  label,
}: {
  options: { key: string; label: string; title?: string }[];
  activeKey: string;
  hrefFor: (key: string) => string;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {options.map((opt) => {
        const active = opt.key === activeKey;
        return (
          <Link
            key={opt.key}
            href={hrefFor(opt.key)}
            aria-current={active ? "true" : undefined}
            title={opt.title}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              // accent-solid, not accent: white-on-accent measures 3.6:1 at this size, below the
              // 4.5:1 text floor, and the themed hover step drops to 2.4:1 in dark mode.
              // accent-solid is mode-invariant and clears 7:1 against white text in both.
              active
                ? "bg-accent-solid text-white"
                : "text-ink-secondary hover:bg-raised hover:text-ink-primary"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
