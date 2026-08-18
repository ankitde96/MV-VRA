"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnswerValue } from "@/lib/questionnaire/evaluator";
import type { Question } from "@/lib/questionnaire/schema";

/**
 * The one component both the builder preview and, once Phase 7 builds it, the vendor
 * portal render a question through — PLAN.md Phase 5 exit criterion ("preview and portal
 * cannot diverge"). Deliberately dumb: given a question and a value, render an input and
 * call back on change. No knowledge of visibility, sections, or persistence — that's
 * `lib/questionnaire/evaluator.ts` and whichever page embeds this.
 */
export function QuestionRenderer({
  question,
  value,
  onChange,
  disabled,
}: {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
}) {
  const id = `q_${question.control_id}`;

  switch (question.type) {
    case "text":
      return (
        <Input
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "number":
      return (
        <Input
          id={id}
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          disabled={disabled}
        />
      );

    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "boolean":
      return (
        <RadioGroup
          value={
            value === null || value === undefined ? undefined : String(value)
          }
          onValueChange={(v) => onChange(v === "true")}
          className="flex flex-row gap-4"
          disabled={disabled}
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="true" />
            Yes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="false" />
            No
          </label>
        </RadioGroup>
      );

    case "single_select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v as string)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi_select": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-4">
          {(question.options ?? []).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? [...selected, option]
                      : selected.filter((v) => v !== option),
                  )
                }
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </div>
      );
    }

    case "file":
      // The answer itself is a file — the portal answer form
      // (components/portal/assessment-answer-form.tsx) renders its evidence-upload widget
      // here instead of a text input; the builder preview has nothing to upload to, so it
      // shows this placeholder.
      return (
        <p className="text-muted-foreground text-sm italic">
          Answer by uploading a file (see the evidence upload control for this
          question).
        </p>
      );
  }
}

/**
 * Renders the evidence hint (`Question.evidence_hint`) below the label, only when it's
 * actually set — an unset hint shows nothing, no placeholder, no empty line (DECISIONS.md).
 * Lives in this shared file, not duplicated in the portal answer form or builder preview,
 * for the same reason `QuestionRenderer` itself is shared: those two must never diverge on
 * what a vendor sees for a given question (this file's own docstring).
 */
export function QuestionLabel({ question }: { question: Question }) {
  return (
    <div>
      <Label
        htmlFor={`q_${question.control_id}`}
        className="flex items-baseline gap-1"
      >
        {question.text}
        {question.required ? <span className="text-destructive">*</span> : null}
      </Label>
      {question.evidence_hint ? (
        <p className="text-muted-foreground mt-1 text-xs">
          Evidence: {question.evidence_hint}
        </p>
      ) : null}
    </div>
  );
}
