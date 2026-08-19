"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionEditor } from "@/components/questionnaire/question-editor";
import { QuestionnairePreview } from "@/components/questionnaire/questionnaire-preview";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import {
  emptyCondition,
  emptyQuestion,
  emptySection,
  hydrateSchema,
  priorControlIds,
  serializeSchema,
  type BuilderCondition,
  type BuilderQuestion,
  type BuilderSection,
} from "@/components/templates/builder-state";

export function AssessmentChecklistEditor({
  assessmentId,
  initialSchema,
  initialUpdatedAt,
}: {
  assessmentId: string;
  initialSchema: QuestionsSchema;
  initialUpdatedAt: string;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(() => hydrateSchema(initialSchema));
  const [saving, setSaving] = useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialUpdatedAt);
  const previewSchema = useMemo(() => serializeSchema(sections), [sections]);

  function updateSection(index: number, patch: Partial<BuilderSection>) {
    setSections((current) =>
      current.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  }
  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<BuilderQuestion>,
  ) {
    setSections((current) =>
      current.map((section, i) =>
        i !== sectionIndex
          ? section
          : {
              ...section,
              questions: section.questions.map((question, j) =>
                j === questionIndex ? { ...question, ...patch } : question,
              ),
            },
      ),
    );
  }
  function updateCondition(
    sectionIndex: number,
    questionIndex: number,
    conditionIndex: number,
    patch: Partial<BuilderCondition>,
  ) {
    setSections((current) =>
      current.map((section, i) =>
        i !== sectionIndex
          ? section
          : {
              ...section,
              questions: section.questions.map((question, j) =>
                j !== questionIndex
                  ? question
                  : {
                      ...question,
                      conditions: question.conditions.map((condition, k) =>
                        k === conditionIndex
                          ? { ...condition, ...patch }
                          : condition,
                      ),
                    },
              ),
            },
      ),
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        `/api/assessments/${assessmentId}/checklist`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questions_schema: serializeSchema(sections),
            expected_updated_at: expectedUpdatedAt,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.message ?? "Could not save the checklist.");
        return;
      }
      setExpectedUpdatedAt(body.assessment.updated_at);
      toast.success("Checklist saved.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-md border p-4">
      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Edit checklist</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="builder" className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <div key={section.uid} className="space-y-4 rounded-md border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label>Section id</Label>
                  <Input
                    required
                    value={section.id}
                    onChange={(e) =>
                      updateSection(sectionIndex, { id: e.target.value })
                    }
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label>Section title</Label>
                  <Input
                    required
                    value={section.title}
                    onChange={(e) =>
                      updateSection(sectionIndex, { title: e.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setSections((current) =>
                      current.filter((_, i) => i !== sectionIndex),
                    )
                  }
                >
                  Remove section
                </Button>
              </div>
              {section.questions.map((question, questionIndex) => (
                <QuestionEditor
                  key={question.uid}
                  question={question}
                  availableControlIds={priorControlIds(
                    sections,
                    sectionIndex,
                    questionIndex,
                  )}
                  onChange={(patch) =>
                    updateQuestion(sectionIndex, questionIndex, patch)
                  }
                  onChangeCondition={(index, patch) =>
                    updateCondition(sectionIndex, questionIndex, index, patch)
                  }
                  onAddCondition={() =>
                    updateQuestion(sectionIndex, questionIndex, {
                      conditions: [...question.conditions, emptyCondition()],
                    })
                  }
                  onRemoveCondition={(index) =>
                    updateQuestion(sectionIndex, questionIndex, {
                      conditions: question.conditions.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  onRemove={() =>
                    updateSection(sectionIndex, {
                      questions: section.questions.filter(
                        (_, i) => i !== questionIndex,
                      ),
                    })
                  }
                />
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateSection(sectionIndex, {
                    questions: [...section.questions, emptyQuestion()],
                  })
                }
              >
                Add question
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSections((current) => [...current, emptySection()])
            }
          >
            Add section
          </Button>
        </TabsContent>
        <TabsContent value="preview">
          <div className="rounded-md border p-4">
            <QuestionnairePreview schema={previewSchema} />
          </div>
        </TabsContent>
      </Tabs>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save checklist"}
      </Button>
    </form>
  );
}
