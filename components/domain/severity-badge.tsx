import { AlertOctagon, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY_META = {
  critical: {
    label: "Critical",
    icon: AlertOctagon,
    className: "bg-risk-critical-surface text-risk-critical",
  },
  high: {
    label: "High",
    icon: AlertTriangle,
    className: "bg-risk-high-surface text-risk-high",
  },
  medium: {
    label: "Medium",
    icon: AlertCircle,
    className: "bg-risk-medium-surface text-risk-medium",
  },
  low: {
    label: "Low",
    icon: Info,
    className: "bg-risk-low-surface text-risk-low",
  },
} as const;

export type Severity = keyof typeof SEVERITY_META;

/** Same icon+label+colour discipline as `RiskTierBadge` — see DESIGN-SYSTEM.md §4. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
