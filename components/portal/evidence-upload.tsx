"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export interface EvidenceItem {
  id: string;
  filename: string;
  mime: string;
  size: number;
}

export function EvidenceUpload({
  assessmentId,
  controlId,
  accept,
  required,
  evidence,
  disabled,
  onUploaded,
  onDeleted,
}: {
  assessmentId: string;
  controlId: string;
  accept?: string[];
  /** ASSESSMENT-WORKFLOW-PLAN.md Stage 1 (D4) — evidence is offered on every question now;
   * this only changes the label, never whether the control renders. */
  required?: boolean;
  evidence: EvidenceItem[];
  disabled?: boolean;
  onUploaded: (evidence: EvidenceItem) => void;
  onDeleted?: (evidenceId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(
        `/api/portal/assessments/${assessmentId}/responses/${controlId}/evidence`,
        { method: "POST", body: formData },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Upload failed.");
        return;
      }
      const { evidence: uploaded } = await response.json();
      onUploaded(uploaded);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(evidenceId: string) {
    setError(null);
    setDeletingId(evidenceId);
    try {
      const response = await fetch(
        `/api/portal/assessments/${assessmentId}/responses/${controlId}/evidence/${evidenceId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not remove the file.");
        return;
      }
      onDeleted?.(evidenceId);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Evidence{required ? " (required)" : " (optional)"}
      </p>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}

      {evidence.length > 0 ? (
        <ul className="space-y-1">
          {evidence.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <a
                href={`/api/portal/assessments/${assessmentId}/responses/${controlId}/evidence/${item.id}`}
                className="text-primary underline"
              >
                {item.filename}
              </a>
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                >
                  {deletingId === item.id ? "Removing…" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!disabled ? (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept?.map((a) => `.${a}`).join(",")}
            className="text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleUpload}
          >
            {loading ? "Uploading…" : error ? "Retry upload" : "Upload"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
