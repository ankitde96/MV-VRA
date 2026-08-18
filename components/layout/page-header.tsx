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
  gradient = false,
  aurora = false,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  gradient?: boolean;
  aurora?: boolean;
  className?: string;
}) {
  const bold = gradient || aurora;
  return (
    <div
      className={cn(
        "relative mb-6 flex flex-col gap-4 overflow-hidden sm:flex-row sm:items-end sm:justify-between",
        bold &&
          "-mx-6 -mt-6 mb-8 rounded-b-xl px-6 pt-6 pb-8 text-white [background:var(--gradient-hero)] sm:items-end",
        className,
      )}
    >
      {aurora ? (
        <>
          <div
            className="aurora-backdrop pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
          <div
            className="grain-overlay pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
        </>
      ) : null}
      <div className="relative min-w-0 space-y-1">
        {breadcrumb}
        <h1
          className={cn(
            "font-heading text-lg font-semibold tracking-tight",
            bold ? "text-2xl text-white" : "text-foreground",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "text-sm",
              bold ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
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
