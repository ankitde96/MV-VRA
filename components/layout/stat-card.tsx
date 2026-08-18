"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useInView, animate } from "motion/react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * DECISIONS.md 025 — the one place count-up animation is sanctioned. Fully inert under
 * `prefers-reduced-motion` (`useReducedMotion()` short-circuits straight to the final
 * value, no animate() call at all) and only ever animates `textContent` via a plain number
 * tween, never layout — DESIGN-SYSTEM.md §3 Motion still governs "transform/opacity only"
 * for anything that *is* animated elsewhere; this is a text-content tween, not a transform.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
  tone?: "default" | "critical" | "high" | "medium" | "low";
  hint?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    // The animate() onUpdate callback is a subscription to an external tween, not a plain
    // derived-state setState — the one case react-hooks/set-state-in-effect exempts.
    if (!inView || reduceMotion) return;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduceMotion]);

  const shown = reduceMotion ? value : display;

  const toneClass =
    tone === "critical"
      ? "text-risk-critical"
      : tone === "high"
        ? "text-risk-high"
        : tone === "medium"
          ? "text-risk-medium"
          : tone === "low"
            ? "text-risk-low"
            : "text-foreground";

  return (
    <Card className="shadow-(--shadow-card)">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {label}
          </p>
          <span
            ref={ref}
            className={cn("text-2xl font-semibold tabular-nums", toneClass)}
          >
            {shown}
          </span>
          {hint ? (
            <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={cn(
              "[&_svg]:size-5 [&_svg]:shrink-0",
              toneClass,
              tone === "default" && "opacity-40",
            )}
          >
            {icon}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
