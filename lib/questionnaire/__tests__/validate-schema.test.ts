import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { questionsSchemaSchema } from "@/lib/questionnaire/schema";
import { validateQuestionsSchemaStructure } from "@/lib/questionnaire/validate-schema";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

function schema(
  questions: QuestionsSchema["sections"][number]["questions"],
): QuestionsSchema {
  return {
    schema_format_version: 1,
    sections: [{ id: "sec_1", title: "Section", questions }],
  };
}

describe("validateQuestionsSchemaStructure", () => {
  it("accepts a valid schema with no cross-references", () => {
    expect(() =>
      validateQuestionsSchemaStructure(
        schema([
          { control_id: "Q1", text: "Q1", type: "text", required: true },
        ]),
      ),
    ).not.toThrow();
  });

  it("accepts an optional non-empty evidence hint", () => {
    expect(
      questionsSchemaSchema.safeParse(
        schema([
          {
            control_id: "Q1",
            text: "Q1",
            type: "text",
            required: true,
            evidence_hint: "Attach the board-approved policy.",
          },
          { control_id: "Q2", text: "Q2", type: "text", required: true },
        ]),
      ).success,
    ).toBe(true);
  });

  it("rejects an empty evidence hint", () => {
    expect(
      questionsSchemaSchema.safeParse(
        schema([
          {
            control_id: "Q1",
            text: "Q1",
            type: "text",
            required: true,
            evidence_hint: "",
          },
        ]),
      ).success,
    ).toBe(false);
  });

  it("accepts a show_if that references an earlier control_id", () => {
    expect(() =>
      validateQuestionsSchemaStructure(
        schema([
          {
            control_id: "HOST-01",
            text: "Hosting?",
            type: "single_select",
            required: true,
          },
          {
            control_id: "HOST-02",
            text: "Provider?",
            type: "single_select",
            required: true,
            show_if: {
              all: [{ control_id: "HOST-01", op: "in", value: ["Cloud"] }],
            },
          },
        ]),
      ),
    ).not.toThrow();
  });

  it("rejects a duplicate control_id", () => {
    expect(() =>
      validateQuestionsSchemaStructure(
        schema([
          { control_id: "Q1", text: "First", type: "text", required: true },
          { control_id: "Q1", text: "Second", type: "text", required: true },
        ]),
      ),
    ).toThrow(ValidationError);
  });

  it("rejects a show_if referencing a control_id that appears later (forward reference)", () => {
    expect(() =>
      validateQuestionsSchemaStructure(
        schema([
          {
            control_id: "Q1",
            text: "Q1",
            type: "text",
            required: true,
            show_if: { all: [{ control_id: "Q2", op: "is_answered" }] },
          },
          { control_id: "Q2", text: "Q2", type: "text", required: true },
        ]),
      ),
    ).toThrow(/forward reference/);
  });

  it("rejects a show_if referencing a control_id that does not exist anywhere", () => {
    expect(() =>
      validateQuestionsSchemaStructure(
        schema([
          {
            control_id: "Q1",
            text: "Q1",
            type: "text",
            required: true,
            show_if: { all: [{ control_id: "GHOST", op: "is_answered" }] },
          },
        ]),
      ),
    ).toThrow(/unknown control_id/);
  });

  it("rejects a question that self-references (a forward reference to itself)", () => {
    expect(() =>
      validateQuestionsSchemaStructure(
        schema([
          {
            control_id: "Q1",
            text: "Q1",
            type: "text",
            required: true,
            show_if: { all: [{ control_id: "Q1", op: "is_answered" }] },
          },
        ]),
      ),
    ).toThrow(/forward reference/);
  });
});
