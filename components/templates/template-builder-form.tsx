"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionnairePreview } from "@/components/questionnaire/questionnaire-preview";
import {
  CONDITION_OPERATORS,
  QUESTION_TYPES,
} from "@/lib/questionnaire/schema";
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
} from "./builder-state";

const SELECT_TYPES = new Set(["single_select", "multi_select"]);

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

function QuestionEditor({
  question,
  availableControlIds,
  onChange,
  onChangeCondition,
  onAddCondition,
  onRemoveCondition,
  onRemove,
}: {
  question: BuilderQuestion;
  availableControlIds: string[];
  onChange: (patch: Partial<BuilderQuestion>) => void;
  onChangeCondition: (index: number, patch: Partial<BuilderCondition>) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
  onRemove: () => void;
}) {
  const isSelect = SELECT_TYPES.has(question.type);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label>Control id</Label>
          <Input
            required
            placeholder="HOST-01"
            value={question.control_id}
            onChange={(e) => onChange({ control_id: e.target.value })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Question text</Label>
          <Input
            required
            value={question.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select
            value={question.type}
            onValueChange={(v) =>
              onChange({ type: v as BuilderQuestion["type"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isSelect ? (
        <div className="space-y-1">
          <Label>Options (comma-separated)</Label>
          <Input
            required
            placeholder="Cloud, On-premise, Hybrid"
            value={question.options.join(", ")}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={question.required}
            onCheckedChange={(c) => onChange({ required: c === true })}
          />
          Required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={question.evidenceRequired}
            onCheckedChange={(c) => onChange({ evidenceRequired: c === true })}
          />
          Requires evidence upload
        </label>
        {question.evidenceRequired ? (
          <div className="flex items-center gap-2 text-sm">
            <Label>Accepted file types</Label>
            <Input
              className="w-40"
              placeholder="pdf, png"
              value={question.evidenceAccept}
              onChange={(e) => onChange({ evidenceAccept: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={question.showIfEnabled}
            onCheckedChange={(c) => onChange({ showIfEnabled: c === true })}
            disabled={availableControlIds.length === 0}
          />
          Show only if a condition matches
          {availableControlIds.length === 0 ? (
            <span className="text-muted-foreground">
              (no earlier questions to reference yet)
            </span>
          ) : null}
        </label>

        {question.showIfEnabled ? (
          <div className="space-y-2 pl-6">
            <div className="flex items-center gap-2 text-sm">
              <span>Match</span>
              <Select
                value={question.showIfMode}
                onValueChange={(v) =>
                  onChange({ showIfMode: v as "all" | "any" })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL of</SelectItem>
                  <SelectItem value="any">ANY of</SelectItem>
                </SelectContent>
              </Select>
              <span>these conditions:</span>
            </div>

            {question.conditions.map((condition, conditionIndex) => (
              <div key={condition.uid} className="flex items-center gap-2">
                <Select
                  value={condition.control_id}
                  onValueChange={(v) =>
                    onChangeCondition(conditionIndex, {
                      control_id: v as string,
                    })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Question…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableControlIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.op}
                  onValueChange={(v) =>
                    onChangeCondition(conditionIndex, {
                      op: v as BuilderCondition["op"],
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {condition.op !== "is_answered" &&
                condition.op !== "is_empty" ? (
                  <Input
                    className="w-40"
                    placeholder={
                      condition.op === "in" || condition.op === "not_in"
                        ? "a, b, c"
                        : "value"
                    }
                    value={condition.value}
                    onChange={(e) =>
                      onChangeCondition(conditionIndex, {
                        value: e.target.value,
                      })
                    }
                  />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveCondition(conditionIndex)}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddCondition}
            >
              Add condition
            </Button>
          </div>
        ) : null}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onRemove}>
        Remove question
      </Button>
    </div>
  );
}
