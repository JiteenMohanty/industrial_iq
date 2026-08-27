import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function BranchNotFound() {
  return (
    <EmptyState
      title="Branch not found"
      body="No branch with that identifier exists in this dataset. It may have been mistyped, or the link may be from a different data extract."
      action={
        <Link href="/branches" className="text-sm font-medium text-accent hover:underline">
          See all branches →
        </Link>
      }
    />
  );
}
