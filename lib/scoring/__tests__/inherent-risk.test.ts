import { describe, expect, it } from "vitest";
import {
  scoreEngagement,
  tierFromScore,
  scoreAndTierEngagement,
  type RiskWeights,
  type IntakeScoringInput,
} from "../inherent-risk";

const weights: RiskWeights = {
  data_classification: { pii: 30, phi: 30, financial: 20, none: 0 },
  network_exposure: { external: 25, internal: 10, none: 0 },
  system_access_level: { admin: 25, write: 15, read: 5, none: 0 },
  business_redundancy: {
    single_source: 20,
    some_redundancy: 10,
    fully_redundant: 0,
  },
};

const thresholds = { tier1_min: 70, tier2_min: 40 };

const baseInput: IntakeScoringInput = {
  data_classification: ["pii"],
  network_exposure: "external",
  system_access_level: "admin",
  business_redundancy: "single_source",
};

describe("scoreEngagement", () => {
  it("sums weighted contributions across all four factors", () => {
    const result = scoreEngagement(baseInput, weights);
    expect(result).toEqual({
      ok: true,
      total: 30 + 25 + 25 + 20,
      breakdown: {
        data_classification: 30,
        network_exposure: 25,
        system_access_level: 25,
        business_redundancy: 20,
      },
    });
  });

  it("sums multiple selected data_classification values", () => {
    const result = scoreEngagement(
      { ...baseInput, data_classification: ["pii", "financial"] },
      weights,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.breakdown.data_classification).toBe(30 + 20);
  });

  it("fails loudly when data_classification is empty", () => {
    const result = scoreEngagement(
      { ...baseInput, data_classification: [] },
      weights,
    );
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining("data_classification"),
    });
  });

  it("fails loudly when a selected value has no configured weight", () => {
    const result = scoreEngagement(
      { ...baseInput, network_exposure: "external" },
      { ...weights, network_exposure: {} },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("network_exposure");
  });

  it("fails loudly when a required field is undefined", () => {
    const result = scoreEngagement(
      // @ts-expect-error - intentionally omitting a required field
      { ...baseInput, system_access_level: undefined },
      weights,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("system_access_level");
  });
});

describe("tierFromScore", () => {
  it("is Tier 1 exactly at tier1_min", () => {
    expect(tierFromScore(70, thresholds)).toBe(1);
  });

  it("is Tier 1 above tier1_min", () => {
    expect(tierFromScore(100, thresholds)).toBe(1);
  });

  it("is Tier 2 just below tier1_min", () => {
    expect(tierFromScore(69, thresholds)).toBe(2);
  });

  it("is Tier 2 exactly at tier2_min", () => {
    expect(tierFromScore(40, thresholds)).toBe(2);
  });

  it("is Tier 3 just below tier2_min", () => {
    expect(tierFromScore(39, thresholds)).toBe(3);
  });

  it("is Tier 3 at zero", () => {
    expect(tierFromScore(0, thresholds)).toBe(3);
  });
});

describe("scoreAndTierEngagement", () => {
  it("produces a tiered result end to end", () => {
    const result = scoreAndTierEngagement(baseInput, weights, thresholds);
    expect(result).toMatchObject({ status: "tiered", tier: 1, total: 100 });
  });

  it("falls to scoring_failed, never a default tier, when a value is unmappable", () => {
    const result = scoreAndTierEngagement(
      { ...baseInput, network_exposure: "external" },
      { ...weights, network_exposure: {} },
      thresholds,
    );
    expect(result.status).toBe("scoring_failed");
    // The critical invariant: no `tier` key exists on a failed result at all — TypeScript
    // enforces this at the type level, but the runtime check documents the intent.
    expect(result).not.toHaveProperty("tier");
  });

  it("falls to scoring_failed when the workspace has no tier_thresholds", () => {
    const result = scoreAndTierEngagement(baseInput, weights, undefined);
    expect(result).toEqual({
      status: "scoring_failed",
      reason: expect.stringContaining("tier_thresholds"),
    });
  });

  it("falls to scoring_failed when tier_thresholds is partially configured", () => {
    // @ts-expect-error - intentionally malformed thresholds
    const result = scoreAndTierEngagement(baseInput, weights, {
      tier1_min: 70,
    });
    expect(result.status).toBe("scoring_failed");
  });
});
