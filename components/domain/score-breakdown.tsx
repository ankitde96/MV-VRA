import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/domain/severity-badge";
import type { RiskSeverityKey } from "@/lib/services/analytics";
import { cn } from "@/lib/utils";

/**
 * DESIGN-SYSTEM.md §4 spec'd `ScoreBreakdown` for Round 1 Phase 3 — "shows factor-by-factor
 * points... the score must be explainable, not just displayed" — never built. This is the
 * vendor-scorecard version (UI Revamp Round 2 Phase E): inherent vs residual side by side
 * with the reduction percentage, plus open risk counts by severity. Risk-severity badges
 * inside stay flat per DESIGN-SYSTEM.md §2/§6 even though the surrounding card is glass.
 */
export function ScoreBreakdown({
  inherentScore,
  residualTotal,
  reductionPercent,
  openRiskBySeverity,
}: {
  inherentScore: number | null;
  residualTotal: number;
  reductionPercent: number | null;
  openRiskBySeverity: Record<RiskSeverityKey, number>;
}) {
  return (
    <Card className="rounded-lg border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Risk score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">
              Inherent
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {inherentScore ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">
              Residual (open)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {residualTotal}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">
              Reduction
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                // Real, not just cosmetic: residual_total sums every open risk's own
                // residual_score, so with multiple concurrent open risks it can legitimately
                // exceed a single-scalar inherent_score — a negative "reduction" means risk
                // carried has grown past the vendor's inherent baseline, and must never
                // read as the same green as an actual reduction (caught live, not assumed).
                reductionPercent === null
                  ? "text-foreground"
                  : reductionPercent > 0
                    ? "text-risk-low"
                    : "text-risk-critical",
              )}
            >
              {reductionPercent !== null
                ? `${Math.round(reductionPercent)}%`
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["critical", "high", "medium", "low"] as const).map((sev) =>
            openRiskBySeverity[sev] > 0 ? (
              <span key={sev} className="inline-flex items-center gap-1">
                <SeverityBadge severity={sev} />
                <span className="text-muted-foreground text-xs tabular-nums">
                  ×{openRiskBySeverity[sev]}
                </span>
              </span>
            ) : null,
          )}
          {Object.values(openRiskBySeverity).every((c) => c === 0) ? (
            <p className="text-muted-foreground text-xs">No open risks.</p>
          ) : null}
        </div>

        {inherentScore === null ? (
          <p className="text-muted-foreground mt-3 text-xs">
            No inherent score on file for this vendor&apos;s engagement —
            reduction cannot be computed.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
