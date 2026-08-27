import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RepNotFound() {
  return (
    <EmptyState
      title="Sales rep not found"
      body="No sales rep with that identifier exists in this dataset. It may have been mistyped, or the link may be from a different data extract."
      action={
        <Link href="/reps" className="text-sm font-medium text-accent hover:underline">
          See all reps →
        </Link>
      }
    />
  );
}
