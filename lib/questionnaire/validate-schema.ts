import { ValidationError } from "@/lib/errors";
import type { QuestionsSchema } from "./schema";

/**
 * DATA-MODEL.md §3's structural rules that a Zod shape check alone can't express:
 * control_id uniqueness, and "forward references are rejected ... which is what makes
 * single-pass evaluation safe" (lib/questionnaire/evaluator.ts's computeVisibility()
 * depends on every show_if target already being visited).
 *
 * Run on every draft save, not only at publish — the spec calls out publish-time
 * rejection as the safety net for what must never reach a frozen snapshot, but there's no
 * reason to let a draft carry an invalid reference in the meantime (this phase's
 * DECISIONS.md entry records this as a deliberate stricter-than-the-letter choice).
 * Throws the first problem found rather than collecting all of them — good enough for a
 * form the builder re-submits after each fix.
 */
export function validateQuestionsSchemaStructure(
  schema: QuestionsSchema,
): void {
  const allControlIds = new Set<string>();
  for (const section of schema.sections) {
    for (const question of section.questions) {
      allControlIds.add(question.control_id);
    }
  }

  const seen = new Set<string>();
  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (seen.has(question.control_id)) {
        throw new ValidationError(
          `Duplicate control_id: "${question.control_id}"`,
        );
      }

      for (const conditionId of referencedControlIds(question)) {
        if (!allControlIds.has(conditionId)) {
          throw new ValidationError(
            `Question "${question.control_id}" has a show_if referencing unknown control_id "${conditionId}"`,
          );
        }
        if (!seen.has(conditionId)) {
          throw new ValidationError(
            `Question "${question.control_id}" has a show_if referencing "${conditionId}", which is declared later — forward references are not allowed`,
          );
        }
      }

      seen.add(question.control_id);
    }
  }
}

function referencedControlIds(
  question: QuestionsSchema["sections"][number]["questions"][number],
) {
  if (!question.show_if) return [];
  return (question.show_if.all ?? question.show_if.any ?? []).map(
    (c) => c.control_id,
  );
}
