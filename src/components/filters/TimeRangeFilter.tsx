"use client";

import { useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const MONTH_LABELS: Record<string, string> = {
  "2025-06": "June 2025",
  "2025-07": "July 2025",
  "2025-08": "August 2025",
  "2025-09": "September 2025",
  "2025-10": "October 2025",
  "2025-11": "November 2025",
  "2025-12": "December 2025",
};

function monthLabel(month: string): string {
  return MONTH_LABELS[month] ?? month;
}

/**
 * FR-026's exact preset list in one native `<select>` (months grouped) plus a custom-range pair of
 * date inputs, revealed only when "Custom range" is chosen. URL-driven throughout (Constitution
 * VI): reads the current preset/month/from/to straight from `useSearchParams()` rather than
 * mirroring them into component state, and every selection navigates immediately via
 * `router.push` — the only local state is the two in-progress custom-date values before "Apply" is
 * pressed, which is UI-in-flight state, not view state (the view itself doesn't change until
 * Apply commits it to the URL). Existing params (branch, overlay, lead, insights) are preserved by
 * copying `searchParams` rather than rebuilding the query string from scratch.
 */
export function TimeRangeFilter({ minDate, maxDate }: { minDate: string; maxDate: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentPreset = searchParams.get("preset") ?? "full";
  const currentMonth = searchParams.get("month");
  const isCustom = currentPreset === "custom";

  const [customFrom, setCustomFrom] = useState(searchParams.get("from") ?? minDate);
  const [customTo, setCustomTo] = useState(searchParams.get("to") ?? maxDate);
  const [showCustom, setShowCustom] = useState(isCustom);

  const selectValue =
    currentPreset === "month" && currentMonth ? `month:${currentMonth}` : currentPreset;

  function navigate(mutate: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSelect(value: string) {
    if (value === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    if (value.startsWith("month:")) {
      const month = value.slice("month:".length);
      navigate((p) => {
        p.set("preset", "month");
        p.set("month", month);
        p.delete("from");
        p.delete("to");
      });
      return;
    }
    navigate((p) => {
      if (value === "full") p.delete("preset");
      else p.set("preset", value);
      p.delete("month");
      p.delete("from");
      p.delete("to");
    });
  }

  function applyCustom() {
    navigate((p) => {
      p.set("preset", "custom");
      p.set("from", customFrom);
      p.set("to", customTo);
      p.delete("month");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="time-range-select" className="text-xs font-medium text-ink-secondary">
        Time range
      </label>
      <select
        id="time-range-select"
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="full">Full range</option>
        <option value="last30">Last 30 days</option>
        <option value="last90">Last 90 days</option>
        <optgroup label="Month">
          {Object.keys(MONTH_LABELS).map((month) => (
            <option key={month} value={`month:${month}`}>
              {monthLabel(month)}
            </option>
          ))}
        </optgroup>
        <option value="custom">Custom range…</option>
      </select>

      {showCustom && (
        <span className="flex items-center gap-2">
          <label className="sr-only" htmlFor="custom-from">
            Custom range start
          </label>
          <input
            id="custom-from"
            type="date"
            min={minDate}
            max={maxDate}
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <span aria-hidden="true" className="text-ink-secondary">
            –
          </span>
          <label className="sr-only" htmlFor="custom-to">
            Custom range end
          </label>
          <input
            id="custom-to"
            type="date"
            min={minDate}
            max={maxDate}
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-md bg-accent px-2 py-1 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Apply
          </button>
        </span>
      )}
    </div>
  );
}
