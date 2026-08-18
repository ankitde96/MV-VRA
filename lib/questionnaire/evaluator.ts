import type { Condition, Question, QuestionsSchema, ShowIf } from "./schema";

export type AnswerValue =
  string | number | boolean | string[] | null | undefined;
export type AnswersMap = Record<string, AnswerValue>;

/**
 * Exported for reuse by the pre-submission validator (Phase 7,
 * lib/services/portal-assessment.ts) — "answered" must mean the same thing when deciding
 * visibility here and when deciding "missing" there, not two subtly different definitions.
 */
export function isAnswered(value: AnswerValue): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * DATA-MODEL.md §3: "A condition referencing an unanswered question evaluates false — the
 * dependent question stays hidden until its parent is answered," for every operator, not
 * just is_answered/is_empty.
 *
 * `in`/`not_in` extend the spec's single-answer example (HOST-01/HOST-02) to a multi_select
 * *answer*: if the answer itself is an array, membership is "any overlap with the
 * condition's value list" rather than exact-array equality — undefined by the spec's
 * example, called out in DECISIONS.md for this phase.
 */
export function evaluateCondition(
  condition: Condition,
  answers: AnswersMap,
): boolean {
  const answer = answers[condition.control_id];

  if (condition.op === "is_answered") return isAnswered(answer);
  if (condition.op === "is_empty") return !isAnswered(answer);
  if (!isAnswered(answer)) return false;

  switch (condition.op) {
    case "eq":
      return answer === condition.value;
    case "neq":
      return answer !== condition.value;
    case "in":
      return matchesSet(answer, condition.value);
    case "not_in":
      return !matchesSet(answer, condition.value);
    case "gt":
      return Number(answer) > Number(condition.value);
    case "lt":
      return Number(answer) < Number(condition.value);
  }
}

function matchesSet(answer: AnswerValue, value: Condition["value"]): boolean {
  const values = Array.isArray(value) ? value : [value];
  if (Array.isArray(answer)) return answer.some((a) => values.includes(a));
  return values.includes(answer as string);
}

export function evaluateShowIf(showIf: ShowIf, answers: AnswersMap): boolean {
  if (showIf.all) return showIf.all.every((c) => evaluateCondition(c, answers));
  return (showIf.any ?? []).some((c) => evaluateCondition(c, answers));
}

/**
 * The one module the builder preview and the future portal renderer both call
 * (PLAN.md §3 Phase 5 exit criterion) — single pass in declaration order, which
 * `validate-schema.ts`'s forward-reference rule is what makes safe: every `show_if`
 * target's visibility is already in the map by the time this question is reached.
 *
 * Suppression cascades structurally, not just through the answer values: if a question's
 * show_if references a control_id that is itself already suppressed, this question is
 * suppressed too, regardless of what its own condition would otherwise evaluate to
 * (DATA-MODEL.md §3, "Suppression cascades").
 */
export function computeVisibility(
  schema: QuestionsSchema,
  answers: AnswersMap,
): Map<string, boolean> {
  const visibility = new Map<string, boolean>();

  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (!question.show_if) {
        visibility.set(question.control_id, true);
        continue;
      }

      const conditions = question.show_if.all ?? question.show_if.any ?? [];
      const dependsOnSuppressed = conditions.some(
        (c) => visibility.get(c.control_id) === false,
      );
      visibility.set(
        question.control_id,
        dependsOnSuppressed ? false : evaluateShowIf(question.show_if, answers),
      );
    }
  }

  return visibility;
}

/** Flat lookup by `control_id` — every question-scoped operation (answer, evidence upload,
 * validation) needs this and the schema is always small enough that a linear scan is fine. */
export function findQuestion(
  schema: QuestionsSchema,
  controlId: string,
): Question | undefined {
  for (const section of schema.sections) {
    const question = section.questions.find((q) => q.control_id === controlId);
    if (question) return question;
  }
  return undefined;
}
