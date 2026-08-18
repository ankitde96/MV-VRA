import { z } from "zod";

/**
 * DATA-MODEL.md §3 — the contract between the template builder, the portal renderer, the
 * conditional-logic evaluator (./evaluator.ts), and every frozen `template_snapshot`.
 * `schema_format_version` is fixed at 1 for the entire MVP; a future format change adds a
 * new literal and a migration path for old snapshots, it never mutates this one.
 */
export const QUESTION_TYPES = [
  "text",
  "textarea",
  "single_select",
  "multi_select",
  "boolean",
  "number",
  "date",
  "file",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CONDITION_OPERATORS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "gt",
  "lt",
  "is_answered",
  "is_empty",
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

const VALUELESS_OPERATORS = new Set<ConditionOperator>([
  "is_answered",
  "is_empty",
]);

const conditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const conditionSchema = z
  .object({
    control_id: z.string().min(1),
    op: z.enum(CONDITION_OPERATORS),
    value: conditionValueSchema.optional(),
  })
  .refine((c) => VALUELESS_OPERATORS.has(c.op) || c.value !== undefined, {
    message: "value is required for every operator except is_answered/is_empty",
  });
export type Condition = z.infer<typeof conditionSchema>;

/**
 * Wire format matches DATA-MODEL.md §3's example exactly: `show_if: { all: [...] }` or
 * `{ any: [...] }`. Restricted here to exactly one of the two keys — the spec's example
 * only ever shows one, and allowing both would leave "how do all and any combine" undefined
 * (DECISIONS.md — this phase's entry records it as a deliberate simplification).
 */
export const showIfSchema = z
  .object({
    all: z.array(conditionSchema).min(1).optional(),
    any: z.array(conditionSchema).min(1).optional(),
  })
  .refine((s) => Boolean(s.all) !== Boolean(s.any), {
    message: 'show_if must have exactly one of "all" or "any"',
  });
export type ShowIf = z.infer<typeof showIfSchema>;

export const questionSchema = z
  .object({
    control_id: z.string().min(1),
    text: z.string().min(1),
    type: z.enum(QUESTION_TYPES),
    options: z.array(z.string().min(1)).optional(),
    required: z.boolean(),
    show_if: showIfSchema.optional(),
    evidence: z
      .object({
        required: z.boolean(),
        accept: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    // Free-text guidance on what evidence to attach/reference when answering — distinct
    // from `evidence.required`/`evidence.accept` above, which govern the file-upload
    // control itself. Optional and unset by default; when absent, the vendor sees nothing
    // extra for that question (no placeholder, no empty hint block) — the renderer only
    // shows this line at all when it's non-empty.
    evidence_hint: z.string().min(1).optional(),
  })
  .refine(
    (q) =>
      !(q.type === "single_select" || q.type === "multi_select") ||
      !!q.options?.length,
    {
      message: "options are required for single_select/multi_select questions",
    },
  );
export type Question = z.infer<typeof questionSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});
export type Section = z.infer<typeof sectionSchema>;

export const questionsSchemaSchema = z.object({
  schema_format_version: z.literal(1),
  sections: z.array(sectionSchema).min(1),
});
export type QuestionsSchema = z.infer<typeof questionsSchemaSchema>;
