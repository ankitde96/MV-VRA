import { describe, expect, it } from "vitest";
import {
  computeVisibility,
  evaluateCondition,
} from "@/lib/questionnaire/evaluator";
import type { Condition, QuestionsSchema } from "@/lib/questionnaire/schema";

function condition(overrides: Partial<Condition>): Condition {
  return { control_id: "Q1", op: "eq", value: "x", ...overrides };
}

describe("evaluateCondition", () => {
  it("eq/neq compare the answer directly", () => {
    expect(
      evaluateCondition(condition({ op: "eq", value: "Cloud" }), {
        Q1: "Cloud",
      }),
    ).toBe(true);
    expect(
      evaluateCondition(condition({ op: "eq", value: "Cloud" }), {
        Q1: "On-premise",
      }),
    ).toBe(false);
    expect(
      evaluateCondition(condition({ op: "neq", value: "Cloud" }), {
        Q1: "On-premise",
      }),
    ).toBe(true);
  });

  it("in/not_in check membership against a value list, per the HOST-01/HOST-02 example", () => {
    const cond = condition({ op: "in", value: ["Cloud", "Hybrid"] });
    expect(evaluateCondition(cond, { Q1: "Cloud" })).toBe(true);
    expect(evaluateCondition(cond, { Q1: "On-premise" })).toBe(false);
    expect(
      evaluateCondition({ ...cond, op: "not_in" }, { Q1: "On-premise" }),
    ).toBe(true);
  });

  it("in/not_in treat a multi_select array answer as overlap, not exact match", () => {
    const cond = condition({ op: "in", value: ["pii", "phi"] });
    expect(evaluateCondition(cond, { Q1: ["financial", "pii"] })).toBe(true);
    expect(evaluateCondition(cond, { Q1: ["financial"] })).toBe(false);
  });

  it("gt/lt compare numerically", () => {
    expect(
      evaluateCondition(condition({ op: "gt", value: 10 }), { Q1: 15 }),
    ).toBe(true);
    expect(
      evaluateCondition(condition({ op: "gt", value: 10 }), { Q1: 5 }),
    ).toBe(false);
    expect(
      evaluateCondition(condition({ op: "lt", value: 10 }), { Q1: 5 }),
    ).toBe(true);
  });

  it("is_answered/is_empty check presence, not equality", () => {
    expect(
      evaluateCondition(condition({ op: "is_answered" }), { Q1: "anything" }),
    ).toBe(true);
    expect(evaluateCondition(condition({ op: "is_answered" }), {})).toBe(false);
    expect(evaluateCondition(condition({ op: "is_empty" }), {})).toBe(true);
    expect(evaluateCondition(condition({ op: "is_empty" }), { Q1: [] })).toBe(
      true,
    );
  });

  it("every non-presence operator evaluates false against an unanswered question", () => {
    for (const op of ["eq", "neq", "in", "not_in", "gt", "lt"] as const) {
      expect(evaluateCondition(condition({ op, value: "x" }), {})).toBe(false);
    }
  });
});

function schema(
  questions: QuestionsSchema["sections"][number]["questions"],
): QuestionsSchema {
  return {
    schema_format_version: 1,
    sections: [{ id: "sec_1", title: "Section", questions }],
  };
}

describe("computeVisibility", () => {
  it("a question with no show_if is always visible", () => {
    const visibility = computeVisibility(
      schema([{ control_id: "Q1", text: "Q1", type: "text", required: true }]),
      {},
    );
    expect(visibility.get("Q1")).toBe(true);
  });

  it("hides a follow-up per the HOST-01/HOST-02 example ('any' over cloud/hybrid)", () => {
    const s = schema([
      {
        control_id: "HOST-01",
        text: "Hosting?",
        type: "single_select",
        required: true,
      },
      {
        control_id: "HOST-02",
        text: "Which provider?",
        type: "single_select",
        required: true,
        show_if: {
          all: [
            { control_id: "HOST-01", op: "in", value: ["Cloud", "Hybrid"] },
          ],
        },
      },
    ]);
    expect(
      computeVisibility(s, { "HOST-01": "On-premise" }).get("HOST-02"),
    ).toBe(false);
    expect(computeVisibility(s, { "HOST-01": "Cloud" }).get("HOST-02")).toBe(
      true,
    );
    expect(computeVisibility(s, {}).get("HOST-02")).toBe(false);
  });

  it("cascades suppression: a question depending on an already-hidden question is hidden too, regardless of its own condition", () => {
    const s = schema([
      { control_id: "A", text: "A", type: "boolean", required: true },
      {
        control_id: "B",
        text: "B",
        type: "boolean",
        required: true,
        show_if: { all: [{ control_id: "A", op: "eq", value: true }] },
      },
      {
        control_id: "C",
        text: "C",
        type: "boolean",
        required: true,
        // C's own condition targets B directly and would be true if B were visible/answered,
        // but B is suppressed (A is false) — C must be suppressed too.
        show_if: { all: [{ control_id: "B", op: "is_answered" }] },
      },
    ]);
    const visibility = computeVisibility(s, { A: false, B: true });
    expect(visibility.get("A")).toBe(true);
    expect(visibility.get("B")).toBe(false);
    expect(visibility.get("C")).toBe(false);
  });

  it("'any' shows a question when at least one condition is true", () => {
    const s = schema([
      { control_id: "A", text: "A", type: "boolean", required: true },
      { control_id: "B", text: "B", type: "boolean", required: true },
      {
        control_id: "C",
        text: "C",
        type: "text",
        required: true,
        show_if: {
          any: [
            { control_id: "A", op: "eq", value: true },
            { control_id: "B", op: "eq", value: true },
          ],
        },
      },
    ]);
    expect(computeVisibility(s, { A: false, B: true }).get("C")).toBe(true);
    expect(computeVisibility(s, { A: false, B: false }).get("C")).toBe(false);
  });
});
