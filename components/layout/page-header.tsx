import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ends the max-w-4xl / max-w-2xl / full-bleed inconsistency UI-REVAMP-PLAN.md Phase 2
 * flagged across the internal console. `gradient` is opt-in and reserved for page heroes
 * (DECISIONS.md 025); every other page header stays flat per DESIGN-SYSTEM.md §2. `aurora`
 * (UI Revamp Round 2, DECISIONS.md 028) layers the mesh backdrop + grain texture on top of
 * the same solid gradient base — implies `gradient`, so passing both is a no-op, not a
 * conflict. Reserved for the dashboard hero, the one surface bold enough to carry it.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumb}
        <h1
          className={cn("text-xl font-semibold tracking-tight text-foreground")}
        >
          {title}
        </h1>
        {description ? (
          <p className={cn("text-sm text-muted-foreground")}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="relative flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
