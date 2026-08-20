// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildAssessmentReportCsv,
  type AssessmentReport,
} from "@/lib/services/assessment-report";
import {
  getAssessmentReportPdfText,
  renderAssessmentReportPdf,
} from "@/lib/services/assessment-report-pdf";

const report: AssessmentReport = {
  generated_at: "2026-08-20T12:00:00.000Z",
  assessment: {
    id: "assessment-1",
    template_name: "Security Review",
    template_version: 3,
    review_round: 1,
    status: "under_review",
    assigned_at: "2026-08-01T00:00:00.000Z",
    submitted_at: "2026-08-10T00:00:00.000Z",
    reviewed_at: null,
  },
  workspace: { name: "Northstar" },
  vendor: { legal_name: "Acme Cloud", tier: 1 },
  engagement: { business_unit: "Payments" },
  reviewers: ["Riya Reviewer"],
  controls: [
    {
      control_id: "SEC-01",
      section: "Security",
      question: "Does the vendor encrypt data, including backups?",
      response: 'Yes, "AES-256"',
      verdict: "non_compliant",
      reviewer_note: "Backup evidence needs review.",
      reviewer: "Riya Reviewer",
      evidence: [
        {
          filename: "backup.pdf",
          mime: "application/pdf",
          size: 128,
          insufficient: true,
          insufficiency_note: "Scope does not include backups",
        },
      ],
      linked_risks: [
        {
          id: "risk-1",
          title: "Unencrypted backups",
          severity: "high",
          status: "open",
        },
      ],
      suppressed: false,
    },
  ],
  sections: [
    {
      title: "Security",
      total: 1,
      compliant: 0,
      non_compliant: 1,
      unmarked: 0,
    },
  ],
  summary: {
    controls: {
      reviewed: 1,
      total: 1,
      compliant: 0,
      non_compliant: 1,
      unmarked: 0,
      suppressed: 0,
    },
    blockers: {
      unmarked_control_ids: [],
      non_compliant_without_risk_control_ids: [],
    },
    risks: {
      total: 1,
      by_severity: { critical: 0, high: 1, medium: 0, low: 0 },
    },
    cap_completeness: { incomplete_tasks: 0, issues: [] },
    insufficient_evidence: { count: 1, control_ids: ["SEC-01"] },
    next_review_due: "2027-08-20T00:00:00.000Z",
    can_complete: true,
  },
};

describe("assessment report exports", () => {
  it("matches the golden CSV with a UTF-8 BOM and RFC-compatible quoting", async () => {
    const golden = await readFile(
      new URL("./fixtures/assessment-report.csv", import.meta.url),
      "utf8",
    );
    const csv = buildAssessmentReportCsv(report);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1).replace(/\r\n/g, "\n")).toBe(golden);
    const formulaReport = structuredClone(report);
    formulaReport.controls[0]!.response = '=HYPERLINK("https://example.test")';
    expect(buildAssessmentReportCsv(formulaReport)).toContain(
      `'="HYPERLINK"`.replace(
        '"HYPERLINK"',
        'HYPERLINK(""https://example.test"")',
      ),
    );
  });

  it("generates a PDF from the same expected report text", async () => {
    const text = getAssessmentReportPdfText(report).join("\n");
    expect(text).toContain("Acme Cloud");
    expect(text).toContain("SEC-01");
    expect(text).toContain("Unencrypted backups (high)");
    const pdf = await renderAssessmentReportPdf(report);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
  });
});
