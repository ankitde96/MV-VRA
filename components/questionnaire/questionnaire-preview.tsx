"use client";

import { useState } from "react";
import {
  computeVisibility,
  type AnswersMap,
} from "@/lib/questionnaire/evaluator";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import { QuestionLabel, QuestionRenderer } from "./question-renderer";

/**
 * Interactive preview — answering a question live re-suppresses/reveals follow-ups through
 * the same `computeVisibility` the future portal will use, which is what makes this a real
 * proof that the schema's conditional logic behaves as authored, not just a static render.
 */
export function QuestionnairePreview({ schema }: { schema: QuestionsSchema }) {
  const [answers, setAnswers] = useState<AnswersMap>({});
  const visibility = computeVisibility(schema, answers);

  return (
    <div className="space-y-6">
      {schema.sections.map((section) => {
        const visibleQuestions = section.questions.filter((q) =>
          visibility.get(q.control_id),
        );
        if (visibleQuestions.length === 0) return null;

        return (
          <div key={section.id} className="space-y-4">
            <h3 className="text-foreground text-sm font-semibold">
              {section.title}
            </h3>
            {visibleQuestions.map((question) => (
              <div key={question.control_id} className="space-y-2">
                <QuestionLabel question={question} />
                <QuestionRenderer
                  question={question}
                  value={answers[question.control_id]}
                  onChange={(value) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.control_id]: value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
