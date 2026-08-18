import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  ShieldQuestion,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { DashboardSummary } from "@/lib/services/dashboard";

const ICONS = {
  overdue_cap: AlertTriangle,
  awaiting_review: ClipboardCheck,
  unscored_vendor: ShieldQuestion,
} as const;

const TONE = {
  overdue_cap: "text-risk-critical",
  awaiting_review: "text-risk-medium",
  unscored_vendor: "text-risk-neutral",
} as const;

export function AttentionQueue({
  items,
}: {
  items: DashboardSummary["attention_queue"];
}) {
  return (
    <Card className="shadow-(--shadow-card)">
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2 className="text-risk-low" />
              </EmptyMedia>
              <EmptyTitle>Nothing needs attention</EmptyTitle>
              <EmptyDescription>
                No overdue CAP tasks, assessments awaiting review, or unscored
                vendors.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-border -mx-6 divide-y">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted flex items-center gap-3 px-6 py-2.5 text-sm transition-colors"
                  >
                    <Icon
                      className={`size-4 shrink-0 ${TONE[item.kind]}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
