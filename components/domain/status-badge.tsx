import { Badge } from "@/components/ui/badge";

/**
 * Replaces the ad-hoc `TIER_STYLE`/`STATUS_STYLE` maps duplicated in `vendors/page.tsx` and
 * `templates/page.tsx` — one status-to-tone mapping, reused everywhere a lifecycle/workflow
 * status renders. Unknown statuses fall back to `secondary` rather than throwing, since new
 * enum values (e.g. a future assessment status) shouldn't crash a table cell.
 */
const STATUS_TONE: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  sent: "outline",
  in_progress: "default",
  submitted: "default",
  under_review: "default",
  completed: "secondary",
  archived: "outline",
  published: "default",
  active: "default",
  inactive: "secondary",
  offboarding: "destructive",
  initiated: "outline",
  verified: "default",
  open: "destructive",
  mitigating: "outline",
  accepted: "secondary",
  closed: "secondary",
  overdue: "destructive",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tone = STATUS_TONE[status] ?? "secondary";
  return (
    <Badge variant={tone} className="capitalize">
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
