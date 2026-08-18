import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";

/**
 * Shared shape for the KRI watchlists (reassessment overdue, portal stall) on the Round 2
 * dashboard — same list-of-vendor-links pattern as `attention-queue.tsx`, generalized so
 * two near-identical components don't drift. `glass` matches `StatCard`'s prop (DECISIONS.md
 * 028) — never applied to the badge itself, which stays a flat risk-semantic surface.
 */
export function KriListCard({
  title,
  emptyTitle,
  emptyDescription,
  icon: Icon,
  items,
}: {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
  items: Array<{
    id: string;
    href: string;
    label: string;
    badge: string;
    badgeTone?: "critical" | "high" | "medium" | "low" | "neutral";
  }>;
}) {
  const badgeToneClass: Record<string, string> = {
    critical: "text-risk-critical bg-risk-critical-surface border-transparent",
    high: "text-risk-high bg-risk-high-surface border-transparent",
    medium: "text-risk-medium bg-risk-medium-surface border-transparent",
    low: "text-risk-low bg-risk-low-surface border-transparent",
    neutral: "text-risk-neutral bg-risk-neutral-surface border-transparent",
  };

  return (
    <Card className="rounded-lg border bg-card shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2 className="text-risk-low" />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-border -mx-6 divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="hover:bg-muted/60 flex items-center justify-between gap-3 px-6 py-2.5 text-sm transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={badgeToneClass[item.badgeTone ?? "neutral"]}
                  >
                    {item.badge}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
