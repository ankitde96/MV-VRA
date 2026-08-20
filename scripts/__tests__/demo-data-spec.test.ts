import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { questionsSchemaSchema } from "@/lib/questionnaire/schema";
import { validateUploadedFile } from "@/lib/uploads/constraints";
import {
  buildDemoResponseSpecs,
  DEMO_CONTROL_COUNT,
  DEMO_EVIDENCE_FIXTURES,
  DEMO_QUESTIONS_SCHEMA,
  parseDemoSeedArgs,
} from "../demo-data-spec";

describe("reviewer demo-data specification", () => {
  it("builds a valid deterministic 25-control questionnaire", () => {
    expect(questionsSchemaSchema.parse(DEMO_QUESTIONS_SCHEMA)).toEqual(
      DEMO_QUESTIONS_SCHEMA,
    );
    expect(
      DEMO_QUESTIONS_SCHEMA.sections.flatMap((section) => section.questions),
    ).toHaveLength(DEMO_CONTROL_COUNT);
  });

  it("produces exact strong and weak compliance profiles", () => {
    const strong = buildDemoResponseSpecs(23);
    const weak = buildDemoResponseSpecs(15);

    expect(
      strong.filter((item) => item.reviewStatus === "compliant"),
    ).toHaveLength(23);
    expect(
      weak.filter((item) => item.reviewStatus === "compliant"),
    ).toHaveLength(15);
    expect((23 / DEMO_CONTROL_COUNT) * 100).toBe(92);
    expect((15 / DEMO_CONTROL_COUNT) * 100).toBe(60);
  });

  it("represents corrected round-zero failures awaiting a new verdict", () => {
    const correctedFailures = buildDemoResponseSpecs(23, true).filter(
      (item) => item.reviewStatus === "non_compliant",
    );

    expect(correctedFailures).toHaveLength(2);
    expect(
      correctedFailures.every((item) => item.responseValue === "Yes"),
    ).toBe(true);
    expect(correctedFailures.every((item) => item.reviewRound === 0)).toBe(
      true,
    );
    expect(correctedFailures[0]?.reviewerNote).toContain("re-submitted");
  });

  it("keeps all four committed fixtures inside the shared upload contract", async () => {
    expect(DEMO_EVIDENCE_FIXTURES.map((fixture) => fixture.mime)).toEqual([
      "application/pdf",
      "image/png",
      "text/csv",
      "text/plain",
    ]);
    for (const fixture of DEMO_EVIDENCE_FIXTURES) {
      const body = await readFile(
        resolve(process.cwd(), "scripts/fixtures", fixture.filename),
      );
      expect(() =>
        validateUploadedFile({
          filename: fixture.filename,
          mime: fixture.mime,
          size: body.byteLength,
        }),
      ).not.toThrow();
      if (fixture.mime === "application/pdf") {
        expect(body.subarray(0, 4).toString("ascii")).toBe("%PDF");
      }
      if (fixture.mime === "image/png") {
        expect(body.subarray(0, 4).toString("hex")).toBe("89504e47");
      }
    }
  });

  it("accepts only the documented reset flag", () => {
    expect(parseDemoSeedArgs([])).toEqual({ resetStorage: false });
    expect(parseDemoSeedArgs(["--reset"])).toEqual({ resetStorage: true });
    expect(() => parseDemoSeedArgs(["--delete"])).toThrow(
      "Unknown demo seed argument",
    );
  });
});
