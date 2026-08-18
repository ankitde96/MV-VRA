/**
 * Pure functions only — no I/O, no model imports. `lib/services/vendor-intake.ts` is the
 * only caller; it resolves `RiskWeights`/`TierThresholds` from `workspace.settings` and
 * passes them in, so this module never needs to know about tenancy or the database.
 *
 * DATA-MODEL.md §4, the rule that matters: a missing or unmappable input is a scoring
 * *failure*, never a score. `scoreEngagement` therefore returns a discriminated union
 * instead of `number | null` — there is no return shape here that a caller could
 * accidentally treat as "scored" when it isn't.
 */

export type DataClassification = "pii" | "phi" | "financial" | "none";
export type NetworkExposure = "external" | "internal" | "none";
export type SystemAccessLevel = "admin" | "write" | "read" | "none";
export type BusinessRedundancy =
  "single_source" | "some_redundancy" | "fully_redundant";

export interface IntakeScoringInput {
  data_classification: DataClassification[];
  network_exposure: NetworkExposure;
  system_access_level: SystemAccessLevel;
  business_redundancy: BusinessRedundancy;
}

/**
 * Mirrors `workspace.settings.risk_weights.<category>` (`Schema.Types.Mixed` in the model —
 * DATA-MODEL.md §2). A category missing entirely, or missing the specific selected value,
 * is what makes scoring fail — see `lookupWeight` below.
 */
export interface RiskWeights {
  data_classification?: Partial<Record<DataClassification, number>>;
  network_exposure?: Partial<Record<NetworkExposure, number>>;
  system_access_level?: Partial<Record<SystemAccessLevel, number>>;
  business_redundancy?: Partial<Record<BusinessRedundancy, number>>;
}

export interface TierThresholds {
  tier1_min: number;
  tier2_min: number;
}

export interface ScoreBreakdown {
  data_classification: number;
  network_exposure: number;
  system_access_level: number;
  business_redundancy: number;
}

export type ScoringResult =
  | {
      ok: true;
      total: number;
      breakdown: ScoreBreakdown;
    }
  | {
      ok: false;
      reason: string;
    };

export type TieringResult =
  | {
      status: "tiered";
      tier: 1 | 2 | 3;
      total: number;
      breakdown: ScoreBreakdown;
    }
  | { status: "scoring_failed"; reason: string };

function lookupWeight<V extends string>(
  category: string,
  value: V | undefined,
  weights: Partial<Record<V, number>> | undefined,
): { ok: true; weight: number } | { ok: false; reason: string } {
  if (!value) {
    return { ok: false, reason: `${category}: no value provided` };
  }
  if (!weights || !(value in weights) || typeof weights[value] !== "number") {
    return {
      ok: false,
      reason: `${category}: no weight configured for value "${value}"`,
    };
  }
  return { ok: true, weight: weights[value] as number };
}

/**
 * Sums weighted contributions across the four factors. `data_classification` is
 * multi-select (an engagement may process PII *and* Financial data at once), so its
 * contribution is a sum over every selected value rather than a single lookup — each
 * value must individually resolve, or the whole score fails.
 */
export function scoreEngagement(
  input: IntakeScoringInput,
  weights: RiskWeights,
): ScoringResult {
  if (!input.data_classification || input.data_classification.length === 0) {
    return {
      ok: false,
      reason: "data_classification: at least one value is required",
    };
  }

  let dataClassificationTotal = 0;
  for (const value of input.data_classification) {
    const result = lookupWeight(
      "data_classification",
      value,
      weights.data_classification,
    );
    if (!result.ok) return { ok: false, reason: result.reason };
    dataClassificationTotal += result.weight;
  }

  const networkExposure = lookupWeight(
    "network_exposure",
    input.network_exposure,
    weights.network_exposure,
  );
  if (!networkExposure.ok) return { ok: false, reason: networkExposure.reason };

  const systemAccessLevel = lookupWeight(
    "system_access_level",
    input.system_access_level,
    weights.system_access_level,
  );
  if (!systemAccessLevel.ok)
    return { ok: false, reason: systemAccessLevel.reason };

  const businessRedundancy = lookupWeight(
    "business_redundancy",
    input.business_redundancy,
    weights.business_redundancy,
  );
  if (!businessRedundancy.ok)
    return { ok: false, reason: businessRedundancy.reason };

  const breakdown: ScoreBreakdown = {
    data_classification: dataClassificationTotal,
    network_exposure: networkExposure.weight,
    system_access_level: systemAccessLevel.weight,
    business_redundancy: businessRedundancy.weight,
  };

  return {
    ok: true,
    total: Object.values(breakdown).reduce((sum, v) => sum + v, 0),
    breakdown,
  };
}

/**
 * `total >= tier1_min` is Tier 1 (highest criticality), matching PLAN.md's naming
 * ("Tier 1 = High Criticality"). Thresholds themselves are not validated for sanity here
 * (e.g. tier1_min <= tier2_min) — malformed workspace settings are a seed/admin-UI
 * concern, not this pure function's.
 */
export function tierFromScore(
  total: number,
  thresholds: TierThresholds,
): 1 | 2 | 3 {
  if (total >= thresholds.tier1_min) return 1;
  if (total >= thresholds.tier2_min) return 2;
  return 3;
}

/**
 * The single entry point the service calls. Combines scoring and tiering so a caller can
 * never end up with a tier computed from a failed score.
 */
export function scoreAndTierEngagement(
  input: IntakeScoringInput,
  weights: RiskWeights,
  thresholds: TierThresholds | undefined,
): TieringResult {
  if (
    !thresholds ||
    typeof thresholds.tier1_min !== "number" ||
    typeof thresholds.tier2_min !== "number"
  ) {
    return {
      status: "scoring_failed",
      reason: "workspace has no tier_thresholds configured",
    };
  }

  const scored = scoreEngagement(input, weights);
  if (!scored.ok) {
    return { status: "scoring_failed", reason: scored.reason };
  }

  return {
    status: "tiered",
    tier: tierFromScore(scored.total, thresholds),
    total: scored.total,
    breakdown: scored.breakdown,
  };
}
