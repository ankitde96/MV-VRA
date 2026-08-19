import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  MAX_UPLOAD_BYTES,
  validateUploadedFile,
} from "@/lib/uploads/constraints";

describe("validateUploadedFile", () => {
  it.each([
    ["report.pdf", "application/pdf"],
    ["controls.csv", "text/csv"],
    ["notes.TXT", "text/plain"],
  ])("accepts %s declared as %s", (filename, mime) => {
    expect(() =>
      validateUploadedFile({ filename, mime, size: 1 }),
    ).not.toThrow();
  });

  it.each([
    ["archive.zip", "application/zip", /Unsupported file type/],
    ["controls.txt", "text/csv", /\.csv file extension/],
    ["notes.csv", "text/plain", /\.txt file extension/],
  ])("rejects %s declared as %s", (filename, mime, message) => {
    expect(() => validateUploadedFile({ filename, mime, size: 1 })).toThrow(
      message,
    );
  });

  it("rejects an empty file", () => {
    expect(() =>
      validateUploadedFile({
        filename: "empty.pdf",
        mime: "application/pdf",
        size: 0,
      }),
    ).toThrowError(new ValidationError("File is empty"));
  });

  it("rejects a file over the unchanged 10 MB limit", () => {
    expect(() =>
      validateUploadedFile({
        filename: "large.pdf",
        mime: "application/pdf",
        size: MAX_UPLOAD_BYTES + 1,
      }),
    ).toThrow(/10MB upload limit/);
  });
});
