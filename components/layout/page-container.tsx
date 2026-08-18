import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One container width for the whole internal console. `wide` (default) is for tables/
 * inventories that want the full available width; `narrow` (max-w-4xl) is for forms and
 * detail panels. Replaces the ad-hoc max-w-4xl / max-w-2xl / max-w-xl / full-bleed mix
 * UI-REVAMP-PLAN.md Phase 2 flagged across app/(internal)/**.
 */
export function PageContainer({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: "wide" | "narrow";
  className?: string;
}) {
  return (
    <div
      className={cn(
        width === "narrow" ? "mx-auto max-w-4xl" : "w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}
