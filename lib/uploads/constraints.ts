import { ValidationError } from "@/lib/errors";

/**
 * PLAN.md A5 assumption (single-digit MB, document-type evidence) — not stated in the
 * spec, which leaves upload limits unspecified. DECISIONS.md 017 records this as a
 * correctable assumption. Extracted from lib/services/vendor-documents.ts (Phase 4) in
 * Phase 7 once a second real caller (evidence upload) needed the identical rule — shared
 * from the moment there were two call sites, not before.
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/csv",
  "text/plain",
]);
const REQUIRED_EXTENSIONS_BY_MIME = new Map([
  ["text/csv", ".csv"],
  ["text/plain", ".txt"],
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateUploadedFile(input: {
  filename: string;
  mime: string;
  size: number;
}): void {
  if (!ALLOWED_MIME_TYPES.has(input.mime)) {
    throw new ValidationError(`Unsupported file type: ${input.mime}`);
  }
  if (input.size === 0) {
    throw new ValidationError("File is empty");
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit`,
    );
  }
  const requiredExtension = REQUIRED_EXTENSIONS_BY_MIME.get(input.mime);
  if (
    requiredExtension &&
    !input.filename.toLowerCase().endsWith(requiredExtension)
  ) {
    throw new ValidationError(
      `${input.mime} uploads must use the ${requiredExtension} file extension`,
    );
  }
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
