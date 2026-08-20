"use client";

import { useState } from "react";
import {
  DownloadIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FlagIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";

type ReviewEvidence = ReviewerQuestionItem["evidence"][number];

interface ReviewEvidenceListProps {
  controlId: string;
  evidence: ReviewEvidence[];
  canEdit: boolean;
  onFlagChange: (
    controlId: string,
    evidenceId: string,
    flag: "insufficient" | null,
    note: string,
  ) => Promise<boolean>;
}

function EvidenceIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <FileImageIcon />;
  if (mime === "text/csv") return <FileSpreadsheetIcon />;
  if (mime === "application/pdf" || mime === "text/plain") {
    return <FileTextIcon />;
  }
  return <FileIcon />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMime(mime: string): string {
  const labels: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG image",
    "image/jpeg": "JPEG image",
    "text/csv": "CSV",
    "text/plain": "Text",
  };
  return labels[mime] ?? mime;
}

export function ReviewEvidenceList({
  controlId,
  evidence,
  canEdit,
  onFlagChange,
}: ReviewEvidenceListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = evidence.find((item) => item.id === selectedId) ?? null;

  function openFlagDialog(item: ReviewEvidence) {
    setSelectedId(item.id);
    setNote(item.flag?.note ?? "");
    setError(null);
  }

  async function persistFlag(
    item: ReviewEvidence,
    flag: "insufficient" | null,
    nextNote: string,
  ) {
    setSavingId(item.id);
    setError(null);
    const saved = await onFlagChange(controlId, item.id, flag, nextNote);
    setSavingId(null);
    if (saved) {
      setSelectedId(null);
      return;
    }
    setError("The evidence annotation could not be saved. Please retry.");
  }

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-[11px] font-semibold">
          Attached evidence ({evidence.length})
        </span>
        <span className="text-muted-foreground text-[10px]">
          Downloads open in a new tab
        </span>
      </div>
      <ul className="grid gap-2 lg:grid-cols-2">
        {evidence.map((item) => (
          <li
            key={item.id}
            data-review-evidence={item.id}
            className="bg-background rounded-md border p-2.5"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-muted-foreground mt-0.5 rounded-md border bg-muted/40 p-1.5 [&_svg]:size-4">
                <EvidenceIcon mime={item.mime} />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-foreground max-w-full truncate font-medium">
                    {item.filename}
                  </span>
                  {item.flag ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    >
                      Insufficient
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-[10px]">
                  {formatMime(item.mime)} · {formatBytes(item.size)} · Uploaded{" "}
                  {new Date(item.uploaded_at).toLocaleDateString()} by{" "}
                  {item.uploaded_by_label}
                </p>
                {item.flag?.note ? (
                  <p className="text-amber-700 dark:text-amber-300">
                    {item.flag.note}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    render={
                      <a
                        href={item.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <DownloadIcon />
                    Download
                  </Button>
                  {canEdit ? (
                    <>
                      <Button
                        type="button"
                        size="xs"
                        variant={item.flag ? "secondary" : "ghost"}
                        disabled={savingId === item.id}
                        onClick={() => openFlagDialog(item)}
                      >
                        <FlagIcon />
                        {item.flag ? "Edit flag" : "Mark insufficient"}
                      </Button>
                      {item.flag ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={savingId === item.id}
                          onClick={() => void persistFlag(item, null, "")}
                        >
                          {savingId === item.id ? "Clearing…" : "Clear flag"}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !savingId) setSelectedId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark evidence insufficient</DialogTitle>
            <DialogDescription>
              This advisory flag helps reviewers find evidence gaps. It does not
              change the control verdict or block completion.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <p className="text-foreground font-medium">
                  {selected.filename}
                </p>
                <p className="text-muted-foreground mt-1">
                  {formatMime(selected.mime)} · {formatBytes(selected.size)}
                </p>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={`evidence-flag-note-${selected.id}`}
                  className="text-xs font-medium"
                >
                  Reviewer note (optional)
                </label>
                <Textarea
                  id={`evidence-flag-note-${selected.id}`}
                  value={note}
                  maxLength={1000}
                  placeholder="Explain what is missing or unclear"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              {error ? (
                <p className="text-destructive text-xs" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingId === selected.id}
                  onClick={() => setSelectedId(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={savingId === selected.id}
                  onClick={() =>
                    void persistFlag(selected, "insufficient", note)
                  }
                >
                  {savingId === selected.id ? "Saving…" : "Save flag"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
