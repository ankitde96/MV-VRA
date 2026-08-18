/**
 * Pure functions only — no I/O, no model imports, no side effects.
 * Calculates residual risk scores based on severity, impact level, inherent risk metrics,
 * and compensating controls.
 *
 * DATA-MODEL.md §4 & DECISIONS.md 008: `risk.residual_score` is authoritative and computed
 * on risk write.
 */

export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type RiskImpactLevel = "critical" | "high" | "medium" | "low";

export interface ResidualRiskInput {
  severity: RiskSeverity;
  impact_level: RiskImpactLevel;
  inherent_score?: number | null;
  compensating_controls?: string[];
}

export interface ResidualInputsSnapshot {
  severity: RiskSeverity;
  severity_base_score: number;
  impact_level: RiskImpactLevel;
  impact_multiplier: number;
  inherent_score: number | null;
  raw_risk_score: number;
  compensating_controls: string[];
  discount_factor: number;
  calculated_at: string;
}

export interface ResidualRiskResult {
  residual_score: number;
  residual_inputs: ResidualInputsSnapshot;
}

const SEVERITY_BASE_SCORES: Record<RiskSeverity, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
};

const IMPACT_MULTIPLIERS: Record<RiskImpactLevel, number> = {
  critical: 1.25,
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

const DISCOUNT_PER_CONTROL = 0.15;
const MAX_CONTROL_DISCOUNT = 0.5;

/**
 * Computes deterministic residual risk score and builds the `residual_inputs` snapshot.
 */
export function calculateResidualScore(
  input: ResidualRiskInput,
): ResidualRiskResult {
  const severityBase = SEVERITY_BASE_SCORES[input.severity] ?? 20;
  const impactMultiplier = IMPACT_MULTIPLIERS[input.impact_level] ?? 1.0;

  const baseScore = severityBase * impactMultiplier;

  const inherentScore =
    typeof input.inherent_score === "number" && !isNaN(input.inherent_score)
      ? input.inherent_score
      : null;

  // If inherent score exists, raw risk score blends base risk score and inherent score
  let rawScore = baseScore;
  if (inherentScore !== null) {
    rawScore = baseScore * 0.7 + inherentScore * 0.3;
  }

  const controls = (input.compensating_controls ?? []).filter(
    (c) => c.trim().length > 0,
  );
  const discountFactor = Math.min(
    controls.length * DISCOUNT_PER_CONTROL,
    MAX_CONTROL_DISCOUNT,
  );

  const finalScore = Math.max(1, Math.round(rawScore * (1 - discountFactor)));

  const residualInputs: ResidualInputsSnapshot = {
    severity: input.severity,
    severity_base_score: severityBase,
    impact_level: input.impact_level,
    impact_multiplier: impactMultiplier,
    inherent_score: inherentScore,
    raw_risk_score: Math.round(rawScore * 10) / 10,
    compensating_controls: controls,
    discount_factor: Math.round(discountFactor * 100) / 100,
    calculated_at: new Date().toISOString(),
  };

  return {
    residual_score: finalScore,
    residual_inputs: residualInputs,
  };
}
