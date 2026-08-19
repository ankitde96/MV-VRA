"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionnairePreview } from "@/components/questionnaire/questionnaire-preview";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import { QuestionEditor } from "@/components/questionnaire/question-editor";
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
} from "./builder-state";

interface TemplateBuilderFormProps {
  templateId?: string;
  initialTemplateKey?: string;
  initialName?: string;
  initialDescription?: string;
  initialSchema?: QuestionsSchema;
}

export function TemplateBuilderForm({
  templateId,
  initialTemplateKey = "",
  initialName = "",
  initialDescription = "",
  initialSchema,
}: TemplateBuilderFormProps) {
  const router = useRouter();
  const isEditing = Boolean(templateId);

  const [templateKey, setTemplateKey] = useState(initialTemplateKey);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [sections, setSections] = useState<BuilderSection[]>(() =>
    initialSchema ? hydrateSchema(initialSchema) : [emptySection()],
  );
  const [loading, setLoading] = useState(false);

  const previewSchema = useMemo(() => serializeSchema(sections), [sections]);

  function updateSection(index: number, patch: Partial<BuilderSection>) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<BuilderQuestion>,
  ) {
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIndex
          ? s
          : {
              ...s,
              questions: s.questions.map((q, qi) =>
                qi === questionIndex ? { ...q, ...patch } : q,
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
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIndex
          ? s
          : {
              ...s,
              questions: s.questions.map((q, qi) =>
                qi !== questionIndex
                  ? q
                  : {
                      ...q,
                      conditions: q.conditions.map((c, ci) =>
                        ci === conditionIndex ? { ...c, ...patch } : c,
                      ),
                    },
              ),
            },
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const questions_schema = serializeSchema(sections);
      const url = isEditing ? `/api/templates/${templateId}` : "/api/templates";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? { name, description, questions_schema }
        : { template_key: templateKey, name, description, questions_schema };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        toast.error(
          responseBody?.message ??
            "Could not save the template. Please try again.",
        );
        return;
      }

      toast.success(isEditing ? "Template saved." : "Template created.");
      router.push("/templates");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid max-w-2xl grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="template_key">Template key</Label>
          <Input
            id="template_key"
            required
            disabled={isEditing}
            placeholder="vendor-security-baseline"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </section>

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          {sections.map((section, sectionIndex) => (
            <div key={section.uid} className="space-y-4 rounded-md border p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Section id</Label>
                  <Input
                    required
                    placeholder="sec_hosting"
                    value={section.id}
                    onChange={(e) =>
                      updateSection(sectionIndex, { id: e.target.value })
                    }
                  />
                </div>
                <div className="flex-1 space-y-2">
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
                    setSections((prev) =>
                      prev.filter((_, i) => i !== sectionIndex),
                    )
                  }
                >
                  Remove section
                </Button>
              </div>

              <div className="space-y-4">
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
                    onChangeCondition={(conditionIndex, patch) =>
                      updateCondition(
                        sectionIndex,
                        questionIndex,
                        conditionIndex,
                        patch,
                      )
                    }
                    onAddCondition={() =>
                      updateQuestion(sectionIndex, questionIndex, {
                        conditions: [...question.conditions, emptyCondition()],
                      })
                    }
                    onRemoveCondition={(conditionIndex) =>
                      updateQuestion(sectionIndex, questionIndex, {
                        conditions: question.conditions.filter(
                          (_, i) => i !== conditionIndex,
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
              </div>

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
            onClick={() => setSections((prev) => [...prev, emptySection()])}
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

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : isEditing ? "Save draft" : "Create template"}
      </Button>
    </form>
  );
}
