"use client";

import { useCallback, useState } from "react";
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
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";

export interface InitialResponse {
  control_id: string;
  response_value: unknown;
  evidence: EvidenceItem[];
  review_status: "compliant" | "non_compliant" | null;
  reviewer_note: string;
}

export function AssessmentAnswerForm({
  assessmentId,
  assessmentStatus,
  schema,
  initialResponses,
  readOnly,
}: {
  assessmentId: string;
  assessmentStatus: string;
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
  const reviewByControl = Object.fromEntries(
    initialResponses.map((response) => [response.control_id, response]),
  );
  const [savingControlIds, setSavingControlIds] = useState<Set<string>>(
    new Set(),
  );
  const [savedAtByControl, setSavedAtByControl] = useState<
    Record<string, Date>
  >({});
  const [saveErrorsByControl, setSaveErrorsByControl] = useState<
    Record<string, string>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);

  const visibility = computeVisibility(schema, answers);
  const visibleSections = schema.sections
    .map((section) => ({
      ...section,
      questions: section.questions.filter((q) => visibility.get(q.control_id)),
    }))
    .filter((section) => section.questions.length > 0);
  const activeSection =
    visibleSections[
      Math.min(currentSection, Math.max(visibleSections.length - 1, 0))
    ];
  const visibleQuestions = visibleSections.flatMap(
    (section) => section.questions,
  );
  const answeredCount = visibleQuestions.filter((question) => {
    const value = answers[question.control_id];
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0)
    );
  }).length;

  const persistAnswer = useCallback(
    async (controlId: string, value: AnswersMap[string]): Promise<boolean> => {
      setSavingControlIds((prev) => new Set(prev).add(controlId));
      setSaveErrorsByControl((prev) => {
        const next = { ...prev };
        delete next[controlId];
        return next;
      });
      try {
        const response = await fetch(
          `/api/portal/assessments/${assessmentId}/responses/${controlId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Your answer could not be saved.");
        }
        // DESIGN-SYSTEM.md §7 rule 1: "Autosave, visibly... Never rely on a final submit
        // button holding an hour of work." A persistent "Saved 14:32" beats a transient
        // "Saving…" that vanishes the instant the request resolves — the vendor should be
        // able to glance back later and confirm their last edit actually landed.
        setSavedAtByControl((prev) => ({
          ...prev,
          [controlId]: new Date(),
        }));
        return true;
      } catch (error) {
        setSaveErrorsByControl((prev) => ({
          ...prev,
          [controlId]:
            error instanceof Error
              ? error.message
              : "Your answer could not be saved.",
        }));
        return false;
      } finally {
        setSavingControlIds((prev) => {
          const next = new Set(prev);
          next.delete(controlId);
          return next;
        });
      }
    },
    [assessmentId],
  );

  const {
    schedule: saveAnswer,
    flush: flushAnswers,
    pendingValues,
  } = useDebouncedAutosave({ onSave: persistAnswer });

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

  function handleEvidenceDeleted(controlId: string, evidenceId: string) {
    setEvidenceByControl((prev) => ({
      ...prev,
      [controlId]: (prev[controlId] ?? []).filter(
        (item) => item.id !== evidenceId,
      ),
    }));
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const saved = await flushAnswers();
      if (saved.some((result) => !result)) {
        setSubmitError(
          "Some answers could not be saved. Retry them before submitting.",
        );
        return;
      }
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
      <div className="rounded-lg border bg-card p-4">
        <div
          className="mb-3 flex flex-wrap gap-2"
          aria-label="Assessment sections"
        >
          {visibleSections.map((section, index) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setCurrentSection(index)}
              className={
                index === currentSection
                  ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : index < currentSection
                    ? "rounded-full bg-brand-tint px-3 py-1.5 text-xs font-semibold text-primary"
                    : "rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
              }
            >
              {index + 1}. {section.title}
            </button>
          ))}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{
              width: `${visibleQuestions.length ? (answeredCount / visibleQuestions.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {answeredCount} of {visibleQuestions.length} visible questions
          answered
        </p>
      </div>
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

      {activeSection ? (
        <div key={activeSection.id} className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Section {currentSection + 1} of {visibleSections.length}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {activeSection.title}
            </h2>
          </div>
          {activeSection.questions.map((question) => (
            <div
              id={`question-${question.control_id}`}
              key={question.control_id}
              className="space-y-3 rounded-lg border bg-card p-5"
            >
              <QuestionLabel question={question} />
              {assessmentStatus === "changes_requested" ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {reviewByControl[question.control_id]?.review_status ===
                    "compliant"
                      ? "✓ Compliant — locked"
                      : "Changes requested"}
                  </p>
                  {reviewByControl[question.control_id]?.reviewer_note ? (
                    <p className="text-muted-foreground mt-1">
                      {reviewByControl[question.control_id]?.reviewer_note}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {question.type !== "file" ? (
                <QuestionRenderer
                  question={question}
                  value={answers[question.control_id]}
                  onChange={(value) =>
                    handleAnswerChange(question.control_id, value)
                  }
                  disabled={
                    isReadOnly ||
                    (assessmentStatus === "changes_requested" &&
                      reviewByControl[question.control_id]?.review_status !==
                        "non_compliant")
                  }
                  size="portal"
                />
              ) : null}
              {savingControlIds.has(question.control_id) ? (
                <span
                  className="text-muted-foreground text-sm"
                  aria-live="polite"
                >
                  Saving…
                </span>
              ) : saveErrorsByControl[question.control_id] ? (
                <div className="flex items-center gap-2" role="alert">
                  <span className="text-destructive text-sm">
                    {saveErrorsByControl[question.control_id]}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void persistAnswer(
                        question.control_id,
                        pendingValues.current[question.control_id] ??
                          answers[question.control_id],
                      )
                    }
                  >
                    Retry save
                  </Button>
                </div>
              ) : savedAtByControl[question.control_id] ? (
                <span
                  className="text-muted-foreground text-sm"
                  aria-live="polite"
                >
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

              {/* D4 (ASSESSMENT-WORKFLOW-PLAN.md Stage 1): evidence upload is offered on
                  every question, not only ones the template author flagged with an
                  `evidence` object — the real seeded questionnaire never sets one. */}
              <EvidenceUpload
                assessmentId={assessmentId}
                controlId={question.control_id}
                accept={question.evidence?.accept}
                required={question.evidence?.required ?? false}
                evidence={evidenceByControl[question.control_id] ?? []}
                disabled={
                  isReadOnly ||
                  (assessmentStatus === "changes_requested" &&
                    reviewByControl[question.control_id]?.review_status !==
                      "non_compliant")
                }
                onUploaded={(item) =>
                  handleEvidenceUploaded(
                    question.control_id,
                    question.type === "file",
                    item,
                  )
                }
                onDeleted={(evidenceId) =>
                  handleEvidenceDeleted(question.control_id, evidenceId)
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {!isReadOnly ? (
        <div className="flex items-center justify-between border-t pt-5">
          <Button
            variant="outline"
            onClick={() => setCurrentSection((value) => Math.max(0, value - 1))}
            disabled={currentSection === 0}
          >
            Back
          </Button>
          {currentSection < visibleSections.length - 1 ? (
            <Button
              onClick={() =>
                setCurrentSection((value) =>
                  Math.min(visibleSections.length - 1, value + 1),
                )
              }
            >
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit assessment"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
