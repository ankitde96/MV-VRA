import { Skeleton } from "@/components/ui/skeleton";

/**
 * DESIGN-SYSTEM.md §6: "Skeletons for anything over 300ms; reserved space so tables do not
 * jump." A generic page skeleton — header + a table-shaped block — covers the common case
 * across app/(internal)/**; pages with a materially different shape (dashboard, rollup) get
 * their own loading.tsx alongside this default.
 */
export default function InternalLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
