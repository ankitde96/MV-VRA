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
  evidence,
  disabled,
  onUploaded,
}: {
  assessmentId: string;
  controlId: string;
  accept?: string[];
  evidence: EvidenceItem[];
  disabled?: boolean;
  onUploaded: (evidence: EvidenceItem) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-2">
      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {evidence.length > 0 ? (
        <ul className="space-y-1">
          {evidence.map((item) => (
            <li key={item.id} className="text-xs">
              <a
                href={`/api/portal/assessments/${assessmentId}/responses/${controlId}/evidence/${item.id}`}
                className="text-primary underline"
              >
                {item.filename}
              </a>
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
            {loading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
