import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ends the max-w-4xl / max-w-2xl / full-bleed inconsistency UI-REVAMP-PLAN.md Phase 2
 * flagged across the internal console. `gradient` is opt-in and reserved for the dashboard
 * hero (DECISIONS.md 025) — every other page header stays flat per DESIGN-SYSTEM.md §2.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  gradient = false,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  gradient?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        gradient &&
          "-mx-6 -mt-6 mb-8 rounded-b-xl px-6 pt-6 pb-8 text-white [background:var(--gradient-hero)] sm:items-end",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumb}
        <h1
          className={cn(
            "text-lg font-semibold tracking-tight",
            gradient ? "text-2xl text-white" : "text-foreground",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "text-sm",
              gradient ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
