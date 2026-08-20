import Link from "next/link";
import { ClockAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OverdueCapQueueItem } from "@/lib/services/assessment-review";

export type OverdueAgeBucket = "1–30" | "31–60" | "61–90" | "90+";

export function getOverdueAgeBucket(
  dueDate: string,
  now: Date = new Date(),
): OverdueAgeBucket {
  const days = Math.max(
    1,
    Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86_400_000),
  );
  if (days <= 30) return "1–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

export function VendorOverdueRemediation({
  items,
}: {
  items: OverdueCapQueueItem[];
}) {
  const now = new Date();
  const buckets: Record<OverdueAgeBucket, number> = {
    "1–30": 0,
    "31–60": 0,
    "61–90": 0,
    "90+": 0,
  };
  for (const item of items) buckets[getOverdueAgeBucket(item.due_date, now)]++;

  return (
    <section className="space-y-4" aria-labelledby="overdue-remediation-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            id="overdue-remediation-title"
            className="text-foreground text-sm font-semibold"
          >
            Overdue remediation
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Open corrective actions past their due date for this vendor.
          </p>
        </div>
        <Badge variant={items.length > 0 ? "destructive" : "outline"}>
          {items.length} overdue
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.entries(buckets) as Array<[OverdueAgeBucket, number]>).map(
          ([label, count]) => (
            <div key={label} className="rounded-md border bg-card p-3">
              <p className="text-muted-foreground text-[10px] font-medium uppercase">
                {label} days
              </p>
              <p className="mt-1 font-mono text-lg font-semibold">{count}</p>
            </div>
          ),
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-5 text-sm">
          No overdue corrective actions.
        </div>
      ) : (
        <div className="divide-y rounded-md border bg-card">
          {items.map((item) => {
            const daysOverdue = Math.max(
              1,
              Math.floor(
                (now.getTime() - new Date(item.due_date).getTime()) /
                  86_400_000,
              ),
            );
            return (
              <div
                key={`${item.risk_id}-${item.task_id}`}
                data-overdue-cap={item.task_id}
                className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <ClockAlert
                      className="text-destructive size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.description}</span>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {item.control_id} · {item.risk_title} · {item.owner_label}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-destructive text-xs font-medium">
                    {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue
                  </span>
                  <Link
                    href={`/risks#risk-${item.risk_id}`}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    Open risk →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
