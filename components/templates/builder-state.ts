import type {
  Condition,
  ConditionOperator,
  Question,
  QuestionsSchema,
  QuestionType,
  Section,
} from "@/lib/questionnaire/schema";

const VALUELESS_OPERATORS = new Set<ConditionOperator>([
  "is_answered",
  "is_empty",
]);

export interface BuilderCondition {
  uid: string;
  control_id: string;
  op: ConditionOperator;
  value: string;
}

export interface BuilderQuestion {
  uid: string;
  control_id: string;
  text: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  evidenceRequired: boolean;
  evidenceAccept: string;
  evidenceHint: string;
  showIfEnabled: boolean;
  showIfMode: "all" | "any";
  conditions: BuilderCondition[];
}

export interface BuilderSection {
  uid: string;
  id: string;
  title: string;
  questions: BuilderQuestion[];
}

function makeUid(): string {
  return crypto.randomUUID();
}

export function emptySection(): BuilderSection {
  return { uid: makeUid(), id: "", title: "", questions: [] };
}

export function emptyQuestion(): BuilderQuestion {
  return {
    uid: makeUid(),
    control_id: "",
    text: "",
    type: "text",
    options: [],
    required: true,
    evidenceRequired: false,
    evidenceAccept: "",
    evidenceHint: "",
    showIfEnabled: false,
    showIfMode: "all",
    conditions: [],
  };
}

export function emptyCondition(): BuilderCondition {
  return { uid: makeUid(), control_id: "", op: "eq", value: "" };
}

/** Flattened, declaration-ordered control_ids up to (not including) the given position — the set a question's own show_if is allowed to reference (DATA-MODEL.md §3's no-forward-references rule). */
export function priorControlIds(
  sections: BuilderSection[],
  sectionIndex: number,
  questionIndex: number,
): string[] {
  const ids: string[] = [];
  for (let s = 0; s <= sectionIndex; s++) {
    const limit =
      s === sectionIndex ? questionIndex : sections[s].questions.length;
    for (let q = 0; q < limit; q++) {
      const controlId = sections[s].questions[q].control_id;
      if (controlId) ids.push(controlId);
    }
  }
  return ids;
}

function parseConditionValue(
  op: ConditionOperator,
  raw: string,
): Condition["value"] {
  if (VALUELESS_OPERATORS.has(op)) return undefined;
  if (op === "in" || op === "not_in") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (op === "gt" || op === "lt") return Number(raw);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function conditionValueToString(value: Condition["value"]): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function serializeSchema(sections: BuilderSection[]): QuestionsSchema {
  return {
    schema_format_version: 1,
    sections: sections.map((section): Section => ({
      id: section.id,
      title: section.title,
      questions: section.questions.map((question): Question => {
        const conditions: Condition[] = question.conditions
          .filter((c) => c.control_id)
          .map((c) => ({
            control_id: c.control_id,
            op: c.op,
            value: parseConditionValue(c.op, c.value),
          }));

        const isSelect =
          question.type === "single_select" || question.type === "multi_select";

        return {
          control_id: question.control_id,
          text: question.text,
          type: question.type,
          required: question.required,
          ...(isSelect ? { options: question.options.filter(Boolean) } : {}),
          ...(question.showIfEnabled && conditions.length > 0
            ? {
                show_if: {
                  [question.showIfMode]: conditions,
                } as Question["show_if"],
              }
            : {}),
          ...(question.evidenceRequired || question.evidenceAccept.trim()
            ? {
                evidence: {
                  required: question.evidenceRequired,
                  ...(question.evidenceAccept.trim()
                    ? {
                        accept: question.evidenceAccept
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      }
                    : {}),
                },
              }
            : {}),
          ...(question.evidenceHint.trim()
            ? { evidence_hint: question.evidenceHint.trim() }
            : {}),
        };
      }),
    })),
  };
}

export function hydrateSchema(schema: QuestionsSchema): BuilderSection[] {
  return schema.sections.map((section) => ({
    uid: makeUid(),
    id: section.id,
    title: section.title,
    questions: section.questions.map((question) => {
      const showIf = question.show_if;
      const mode: "all" | "any" = showIf?.all ? "all" : "any";
      const conditions = showIf?.all ?? showIf?.any ?? [];

      return {
        uid: makeUid(),
        control_id: question.control_id,
        text: question.text,
        type: question.type,
        options: question.options ?? [],
        required: question.required,
        evidenceRequired: question.evidence?.required ?? false,
        evidenceAccept: question.evidence?.accept?.join(", ") ?? "",
        evidenceHint: question.evidence_hint ?? "",
        showIfEnabled: Boolean(showIf),
        showIfMode: mode,
        conditions: conditions.map((c) => ({
          uid: makeUid(),
          control_id: c.control_id,
          op: c.op,
          value: conditionValueToString(c.value),
        })),
      };
    }),
  }));
}
