"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface VendorDocumentListItem {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploaded_at: string;
}

interface VendorDocumentUploadProps {
  vendorId: string;
  documents: VendorDocumentListItem[];
}

export function VendorDocumentUpload({
  vendorId,
  documents,
}: VendorDocumentUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch(`/api/vendors/${vendorId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Upload failed. Please try again.");
        return;
      }

      toast.success("Document uploaded.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="truncate">{doc.filename}</span>
              <a
                href={`/api/vendors/${vendorId}/documents/${doc.id}`}
                className="text-primary shrink-0 underline"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          className="text-sm"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
