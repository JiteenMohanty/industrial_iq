"use client";

import { usePathname } from "next/navigation";
import { TimeRangeFilter } from "./TimeRangeFilter";
import { BranchFilter } from "./BranchFilter";

interface BranchOption {
  id: string;
  label: string;
}

/**
 * The shared filter bar, route-aware.
 *
 * A global control that silently does nothing on the page you are looking at is worse than no
 * control at all — it reads as broken. So the bar shows only the controls that actually reach the
 * current view, and where a page deliberately ignores one, it says so in a line beside the
 * controls rather than leaving the reader to guess from an unchanged screen.
 *
 * Two kinds of exception exist, both intentional:
 *
 *   - **Single-entity detail pages** (`/branches/[id]`, `/reps/[id]`) scope themselves from their
 *     own URL path. A branch dropdown there could only ever contradict the page or empty it, so it
 *     is hidden.
 *   - **Cross-branch comparison pages** (`/branches`) exist to rank every branch. Narrowing them to
 *     one row would remove the only thing they do, so the branch control is hidden and the time
 *     control stays.
 *
 * Everything else responds to both filters; `tests/filters/scope-coverage.spec.ts` asserts that
 * function by function, in both directions.
 */
export function FilterBar({
  minDate,
  maxDate,
  branches,
}: {
  minDate: string;
  maxDate: string;
  branches: readonly BranchOption[];
}) {
  const pathname = usePathname();

  const isEntityDetail = /^\/(branches|reps)\/[^/]+$/.test(pathname);
  const isBranchComparison = pathname === "/branches";
  const showBranch = !isEntityDetail && !isBranchComparison;

  const note = isEntityDetail
    ? "This page is scoped to one record by its address, so the branch filter does not apply here."
    : isBranchComparison
      ? "Branch filter hidden: this page compares every branch."
      : pathname === "/funnel" || pathname === "/"
        ? "Alerts and the gate breakdown follow the branch filter but not the time range — a live problem must not disappear behind a narrow window."
        : pathname === "/leads"
          ? "Scoped by branch only, so a list opened from an alert always holds exactly what that alert counted."
          : null;

  return (
    <div className="border-t border-grid bg-page px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1">
        <TimeRangeFilter minDate={minDate} maxDate={maxDate} />
        {showBranch && <BranchFilter branches={branches} />}
        {note && (
          <p className="basis-full text-[11px] leading-snug text-ink-muted lg:basis-auto">{note}</p>
        )}
      </div>
    </div>
  );
}
