import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RepNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        title="Sales rep not found"
        description="There is no sales rep with that identifier. It may have been mistyped, or the link may be out of date."
      />
      <div className="mt-4 text-center">
        <Link href="/branches" className="text-sm font-medium text-accent hover:underline">
          Back to all branches
        </Link>
      </div>
    </div>
  );
}
