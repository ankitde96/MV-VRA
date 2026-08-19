"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONDITION_OPERATORS,
  QUESTION_TYPES,
} from "@/lib/questionnaire/schema";
import type {
  BuilderCondition,
  BuilderQuestion,
} from "@/components/templates/builder-state";

const SELECT_TYPES = new Set(["single_select", "multi_select"]);

export function QuestionEditor({
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label>Control id</Label>
          <Input
            required
            placeholder="HOST-01"
            value={question.control_id}
            onChange={(e) => onChange({ control_id: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
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
              {QUESTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
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
                  .map((value) => value.trim())
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
            onCheckedChange={(checked) =>
              onChange({ required: checked === true })
            }
          />
          Required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={question.evidenceRequired}
            onCheckedChange={(checked) =>
              onChange({ evidenceRequired: checked === true })
            }
          />
          Requires evidence upload
        </label>
        {question.evidenceRequired ? (
          <div className="flex w-full flex-col gap-2 text-sm sm:w-auto sm:flex-row sm:items-center">
            <Label>Accepted file types</Label>
            <Input
              className="w-full sm:w-40"
              placeholder="pdf, png"
              value={question.evidenceAccept}
              onChange={(e) => onChange({ evidenceAccept: e.target.value })}
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label>Evidence hint</Label>
        <Input
          placeholder="e.g. Board-approved policy document, approval minutes"
          value={question.evidenceHint}
          onChange={(e) => onChange({ evidenceHint: e.target.value })}
        />
        <p className="text-muted-foreground text-xs">
          Shown to the vendor under the question as guidance on what to
          reference or attach. Leave blank to show nothing — separate from
          &quot;Requires evidence upload&quot; above.
        </p>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={question.showIfEnabled}
            onCheckedChange={(checked) =>
              onChange({ showIfEnabled: checked === true })
            }
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
          <div className="space-y-2 pl-0 sm:pl-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Match</span>
              <Select
                value={question.showIfMode}
                onValueChange={(value) =>
                  onChange({ showIfMode: value as "all" | "any" })
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
            {question.conditions.map((condition, index) => (
              <div
                key={condition.uid}
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <Select
                  value={condition.control_id}
                  onValueChange={(value) =>
                    onChangeCondition(index, { control_id: value as string })
                  }
                >
                  <SelectTrigger className="w-full sm:w-36">
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
                  onValueChange={(value) =>
                    onChangeCondition(index, {
                      op: value as BuilderCondition["op"],
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-32">
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
                    className="w-full sm:w-40"
                    placeholder={
                      condition.op === "in" || condition.op === "not_in"
                        ? "a, b, c"
                        : "value"
                    }
                    value={condition.value}
                    onChange={(e) =>
                      onChangeCondition(index, { value: e.target.value })
                    }
                  />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveCondition(index)}
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
