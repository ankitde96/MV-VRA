"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  computeVisibility,
  type AnswersMap,
} from "@/lib/questionnaire/evaluator";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import {
  QuestionLabel,
  QuestionRenderer,
} from "@/components/questionnaire/question-renderer";
import {
  EvidenceUpload,
  type EvidenceItem,
} from "@/components/portal/evidence-upload";

export interface InitialResponse {
  control_id: string;
  response_value: unknown;
  evidence: EvidenceItem[];
}

const SAVE_DEBOUNCE_MS = 400;

export function AssessmentAnswerForm({
  assessmentId,
  schema,
  initialResponses,
  readOnly,
}: {
  assessmentId: string;
  schema: QuestionsSchema;
  initialResponses: InitialResponse[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswersMap>(() =>
    Object.fromEntries(
      initialResponses.map((r) => [
        r.control_id,
        r.response_value as AnswersMap[string],
      ]),
    ),
  );
  const [evidenceByControl, setEvidenceByControl] = useState<
    Record<string, EvidenceItem[]>
  >(() =>
    Object.fromEntries(initialResponses.map((r) => [r.control_id, r.evidence])),
  );
  const [savingControlIds, setSavingControlIds] = useState<Set<string>>(
    new Set(),
  );
  const [savedAtByControl, setSavedAtByControl] = useState<
    Record<string, Date>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const visibility = computeVisibility(schema, answers);

  const saveAnswer = useCallback(
    (controlId: string, value: AnswersMap[string]) => {
      clearTimeout(saveTimers.current[controlId]);
      saveTimers.current[controlId] = setTimeout(async () => {
        setSavingControlIds((prev) => new Set(prev).add(controlId));
        try {
          const response = await fetch(
            `/api/portal/assessments/${assessmentId}/responses/${controlId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value }),
            },
          );
          // DESIGN-SYSTEM.md §7 rule 1: "Autosave, visibly... Never rely on a final submit
          // button holding an hour of work." A persistent "Saved 14:32" beats a transient
          // "Saving…" that vanishes the instant the request resolves — the vendor should be
          // able to glance back later and confirm their last edit actually landed.
          if (response.ok) {
            setSavedAtByControl((prev) => ({
              ...prev,
              [controlId]: new Date(),
            }));
          }
        } finally {
          setSavingControlIds((prev) => {
            const next = new Set(prev);
            next.delete(controlId);
            return next;
          });
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [assessmentId],
  );

  function handleAnswerChange(controlId: string, value: AnswersMap[string]) {
    setAnswers((prev) => ({ ...prev, [controlId]: value }));
    saveAnswer(controlId, value);
  }

  function handleEvidenceUploaded(
    controlId: string,
    isFileType: boolean,
    item: EvidenceItem,
  ) {
    setEvidenceByControl((prev) => ({
      ...prev,
      [controlId]: [...(prev[controlId] ?? []), item],
    }));
    // A file-type question's "answer" is the upload itself — record the filename as the
    // response_value so submission's generic `required` check (isAnswered(response_value))
    // doesn't need a type='file' special case.
    if (isFileType) {
      handleAnswerChange(controlId, item.filename);
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/portal/assessments/${assessmentId}/submit`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setSubmitError(body?.message ?? "Could not submit the assessment.");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isReadOnly = readOnly || submitted;

  return (
    <div className="space-y-8">
      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      {isReadOnly ? (
        <Alert>
          <AlertDescription>
            This assessment has been submitted and can no longer be edited.
          </AlertDescription>
        </Alert>
      ) : null}

      {schema.sections.map((section) => {
        const visibleQuestions = section.questions.filter((q) =>
          visibility.get(q.control_id),
        );
        if (visibleQuestions.length === 0) return null;

        return (
          <div key={section.id} className="space-y-4">
            <h2 className="text-foreground text-sm font-semibold">
              {section.title}
            </h2>
            {visibleQuestions.map((question) => (
              <div key={question.control_id} className="space-y-2">
                <QuestionLabel question={question} />
                {question.type !== "file" ? (
                  <QuestionRenderer
                    question={question}
                    value={answers[question.control_id]}
                    onChange={(value) =>
                      handleAnswerChange(question.control_id, value)
                    }
                    disabled={isReadOnly}
                  />
                ) : null}
                {savingControlIds.has(question.control_id) ? (
                  <span className="text-muted-foreground text-sm">Saving…</span>
                ) : savedAtByControl[question.control_id] ? (
                  <span className="text-muted-foreground text-sm">
                    Saved{" "}
                    {savedAtByControl[question.control_id].toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                ) : null}

                {question.type === "file" || question.evidence ? (
                  <EvidenceUpload
                    assessmentId={assessmentId}
                    controlId={question.control_id}
                    accept={question.evidence?.accept}
                    evidence={evidenceByControl[question.control_id] ?? []}
                    disabled={isReadOnly}
                    onUploaded={(item) =>
                      handleEvidenceUploaded(
                        question.control_id,
                        question.type === "file",
                        item,
                      )
                    }
                  />
                ) : null}
              </div>
            ))}
          </div>
        );
      })}

      {!isReadOnly ? (
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit assessment"}
        </Button>
      ) : null}
    </div>
  );
}
