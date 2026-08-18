import { ShieldAlert, ShieldQuestion, Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_META = {
  1: {
    label: "Tier 1",
    icon: ShieldAlert,
    className: "bg-risk-critical-surface text-risk-critical",
  },
  2: {
    label: "Tier 2",
    icon: Shield,
    className: "bg-risk-high-surface text-risk-high",
  },
  3: {
    label: "Tier 3",
    icon: ShieldCheck,
    className: "bg-risk-low-surface text-risk-low",
  },
} as const;

/**
 * DESIGN-SYSTEM.md §4: icon + label + colour always — colour alone is never sufficient in a
 * tool colourblind reviewers use to make risk calls (§3). A `null`/unscored tier renders a
 * visible "Not scored" warning, never blank and never a low-risk green — an unscored vendor
 * is a gap to close, not a clean bill of health.
 */
export function RiskTierBadge({
  tier,
  scoringFailed = false,
}: {
  tier: number | null;
  scoringFailed?: boolean;
}) {
  if (scoringFailed || tier === null || !(tier in TIER_META)) {
    return (
      <span
        className={cn(
          "bg-risk-neutral-surface text-risk-neutral inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        )}
      >
        <ShieldQuestion className="size-3.5" aria-hidden="true" />
        {scoringFailed ? "Scoring failed" : "Not scored"}
      </span>
    );
  }

  const meta = TIER_META[tier as 1 | 2 | 3];
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
