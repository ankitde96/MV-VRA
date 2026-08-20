import type { QuestionsSchema } from "@/lib/questionnaire/schema";

export const DEMO_CONTROL_COUNT = 25;

const SECTION_NAMES = [
  "Governance",
  "Identity and access",
  "Data protection",
  "Operational resilience",
  "Incident response",
] as const;

const CONTROL_TOPICS = [
  "Security policy is approved and reviewed annually",
  "Security roles and responsibilities are documented",
  "Personnel complete annual security awareness training",
  "Third-party dependencies are reviewed for security risk",
  "Control exceptions have documented owners and expiry dates",
  "Multi-factor authentication protects privileged access",
  "Access is granted using least-privilege principles",
  "Dormant accounts are reviewed and removed quarterly",
  "Privileged activity is logged and independently reviewed",
  "Joiner, mover, and leaver access changes meet the SLA",
  "Sensitive data is encrypted in transit",
  "Sensitive data is encrypted at rest",
  "Data retention periods are documented and enforced",
  "Production data is excluded from lower environments",
  "Data deletion requests are tracked to completion",
  "Backups are encrypted and restoration is tested",
  "Recovery objectives are documented and tested",
  "Critical services have monitored capacity thresholds",
  "Production changes require review and rollback plans",
  "Vulnerabilities are remediated within defined timelines",
  "An incident response plan is tested annually",
  "Security events are monitored and triaged",
  "Material incidents are notified within contractual timelines",
  "Forensic evidence is retained with chain of custody",
  "Post-incident actions are assigned and tracked",
] as const;

export const DEMO_QUESTIONS_SCHEMA: QuestionsSchema = {
  schema_format_version: 1,
  sections: SECTION_NAMES.map((title, sectionIndex) => ({
    id: `demo-section-${sectionIndex + 1}`,
    title,
    questions: CONTROL_TOPICS.slice(sectionIndex * 5, sectionIndex * 5 + 5).map(
      (text, questionIndex) => {
        const ordinal = sectionIndex * 5 + questionIndex + 1;
        return {
          control_id: `DEMO-CTRL-${String(ordinal).padStart(2, "0")}`,
          text,
          type: "single_select" as const,
          options: ["Yes", "No"],
          required: true,
          evidence: {
            required: false,
            accept: ["application/pdf", "image/png", "text/csv", "text/plain"],
          },
          evidence_hint:
            "Attach a current policy, report, or control export when available.",
        };
      },
    ),
  })),
};

export interface DemoResponseSpec {
  controlId: string;
  questionText: string;
  responseValue: "Yes" | "No";
  reviewStatus: "compliant" | "non_compliant";
  reviewerNote: string;
  reviewRound: number;
}

export function buildDemoResponseSpecs(
  compliantControls: number,
  correctionRound = false,
): DemoResponseSpec[] {
  if (
    !Number.isInteger(compliantControls) ||
    compliantControls < 0 ||
    compliantControls > DEMO_CONTROL_COUNT
  ) {
    throw new Error(
      `compliantControls must be an integer from 0 to ${DEMO_CONTROL_COUNT}`,
    );
  }

  return DEMO_QUESTIONS_SCHEMA.sections
    .flatMap((section) => section.questions)
    .map((question, absoluteIndex) => {
      const compliant = absoluteIndex < compliantControls;
      return {
        controlId: question.control_id,
        questionText: question.text,
        responseValue:
          correctionRound && !compliant ? "Yes" : compliant ? "Yes" : "No",
        reviewStatus: compliant ? "compliant" : "non_compliant",
        reviewerNote: compliant
          ? "Control design and supplied evidence meet the review expectation."
          : correctionRound
            ? "Original response was rejected in round 0; the vendor has corrected and re-submitted it for review."
            : "Control gap requires remediation and a tracked corrective action.",
        reviewRound: 0,
      };
    });
}

export const DEMO_EVIDENCE_FIXTURES = [
  {
    controlId: "DEMO-CTRL-01",
    filename: "information-security-policy.pdf",
    mime: "application/pdf",
  },
  {
    controlId: "DEMO-CTRL-08",
    filename: "quarterly-access-review.png",
    mime: "image/png",
  },
  {
    controlId: "DEMO-CTRL-13",
    filename: "data-retention-control-matrix.csv",
    mime: "text/csv",
  },
  {
    controlId: "DEMO-CTRL-21",
    filename: "incident-response-test-summary.txt",
    mime: "text/plain",
  },
] as const;

export function parseDemoSeedArgs(args: string[]): { resetStorage: boolean } {
  const unknown = args.filter((arg) => arg !== "--reset");
  if (unknown.length > 0) {
    throw new Error(`Unknown demo seed argument: ${unknown.join(", ")}`);
  }
  return { resetStorage: args.includes("--reset") };
}
