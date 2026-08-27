"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";

interface BranchOption {
  id: string;
  label: string;
}

/**
 * FR-027's single-branch scope, as a plain native `<select>` writing `?branch=` on the current
 * pathname — same URL-driven pattern as `TimeRangeFilter`.
 *
 * Visibility is decided by `FilterBar`, which hides this control on the routes where it cannot
 * apply (single-entity detail pages, which scope from their own path, and the branch comparison,
 * which exists to show every branch). It used to render everywhere and do nothing on most of them.
 */
export function BranchFilter({ branches }: { branches: readonly BranchOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentBranch = searchParams.get("branch") ?? "";

  function handleSelect(branchId: string) {
    const next = new URLSearchParams(searchParams);
    if (branchId) next.set("branch", branchId);
    else next.delete("branch");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="branch-select" className="text-xs font-medium text-ink-secondary">
        Branch
      </label>
      <select
        id="branch-select"
        value={currentBranch}
        onChange={(e) => handleSelect(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink-primary transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
    </div>
  );
}
