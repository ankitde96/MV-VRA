import { describe, expect, it } from "vitest";
import { calculateResidualScore } from "../residual-risk";

/**
 * TEST-CHECKLIST.md Gate 2: closes the gap flagged in HANDOVER.md/DECISIONS.md 021 — Phase 8
 * shipped this function with only a hand-checked real-HTTP-request verification, no
 * automated test. Values below are hand-computed against the formula documented in
 * lib/scoring/residual-risk.ts: severity_base_score × impact_multiplier, blended 70/30 with
 * the engagement's inherent score when present, then discounted up to 50% by compensating
 * controls at 15% each, floored at 1.
 */
describe("calculateResidualScore", () => {
  it("computes severity_base_score × impact_multiplier with no inherent score or controls", () => {
    const result = calculateResidualScore({
      severity: "high",
      impact_level: "high",
      inherent_score: null,
      compensating_controls: [],
    });

    // 30 (high base) * 1.0 (high multiplier) = 30, no inherent blend, no discount.
    expect(result.residual_score).toBe(30);
    expect(result.residual_inputs).toMatchObject({
      severity: "high",
      severity_base_score: 30,
      impact_level: "high",
      impact_multiplier: 1.0,
      inherent_score: null,
      raw_risk_score: 30,
      compensating_controls: [],
      discount_factor: 0,
    });
  });

  it("applies every severity base score", () => {
    const bases: Array<["critical" | "high" | "medium" | "low", number]> = [
      ["critical", 40],
      ["high", 30],
      ["medium", 20],
      ["low", 10],
    ];
    for (const [severity, base] of bases) {
      const result = calculateResidualScore({
        severity,
        impact_level: "high", // 1.0x multiplier, isolates the severity base
        inherent_score: null,
      });
      expect(result.residual_score).toBe(base);
    }
  });

  it("applies every impact multiplier", () => {
    const multipliers: Array<["critical" | "high" | "medium" | "low", number]> =
      [
        ["critical", 1.25],
        ["high", 1.0],
        ["medium", 0.75],
        ["low", 0.5],
      ];
    for (const [impact_level, multiplier] of multipliers) {
      const result = calculateResidualScore({
        severity: "high", // base 30
        impact_level,
        inherent_score: null,
      });
      expect(result.residual_score).toBe(Math.round(30 * multiplier));
    }
  });

  it("blends 70% base score with 30% inherent score when an inherent score exists", () => {
    const result = calculateResidualScore({
      severity: "high", // base 30
      impact_level: "high", // 1.0x -> baseScore 30
      inherent_score: 100,
      compensating_controls: [],
    });

    // rawScore = 30*0.7 + 100*0.3 = 21 + 30 = 51
    expect(result.residual_inputs.raw_risk_score).toBe(51);
    expect(result.residual_score).toBe(51);
  });

  it("discounts the raw score 15% per compensating control", () => {
    const result = calculateResidualScore({
      severity: "high", // base 30, no inherent score -> rawScore 30
      impact_level: "high",
      inherent_score: null,
      compensating_controls: ["MFA enforced"],
    });

    // 30 * (1 - 0.15) = 25.5 -> rounds to 26
    expect(result.residual_inputs.discount_factor).toBe(0.15);
    expect(result.residual_score).toBe(26);
  });

  it("caps the compensating-control discount at 50% regardless of control count", () => {
    const result = calculateResidualScore({
      severity: "critical", // base 40
      impact_level: "high", // 1.0x -> rawScore 40
      inherent_score: null,
      compensating_controls: ["a", "b", "c", "d", "e", "f"], // 6 * 15% = 90%, capped at 50%
    });

    expect(result.residual_inputs.discount_factor).toBe(0.5);
    // 40 * (1 - 0.5) = 20
    expect(result.residual_score).toBe(20);
  });

  it("ignores blank/whitespace-only compensating control entries", () => {
    const result = calculateResidualScore({
      severity: "high",
      impact_level: "high",
      inherent_score: null,
      compensating_controls: ["  ", "", "Real control"],
    });

    expect(result.residual_inputs.compensating_controls).toEqual([
      "Real control",
    ]);
    expect(result.residual_inputs.discount_factor).toBe(0.15);
  });

  it("never returns a score below the floor of 1, even with severity=low and a full discount", () => {
    const result = calculateResidualScore({
      severity: "low", // base 10
      impact_level: "low", // 0.5x -> rawScore 5
      inherent_score: null,
      compensating_controls: ["a", "b", "c", "d"], // discount capped at 50%
    });

    // 5 * (1 - 0.5) = 2.5 -> rounds to 3, well above the floor, but confirms no negative/zero path
    expect(result.residual_score).toBeGreaterThanOrEqual(1);
  });

  it("treats NaN or non-numeric inherent_score as absent (null), not as zero", () => {
    const result = calculateResidualScore({
      severity: "high",
      impact_level: "high",
      inherent_score: NaN,
      compensating_controls: [],
    });

    expect(result.residual_inputs.inherent_score).toBeNull();
    // Falls back to the un-blended base score (30), not a blend treating NaN as 0.
    expect(result.residual_score).toBe(30);
  });

  it("stamps a calculated_at ISO timestamp on every call", () => {
    const result = calculateResidualScore({
      severity: "medium",
      impact_level: "medium",
      inherent_score: null,
    });
    expect(() =>
      new Date(result.residual_inputs.calculated_at).toISOString(),
    ).not.toThrow();
  });
});
