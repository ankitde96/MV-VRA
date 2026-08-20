import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { AssessmentReport } from "./assessment-report";

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 9, color: "#1f2937" },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#111827" },
  subtitle: { fontSize: 11, color: "#4b5563", marginBottom: 24 },
  heading: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 8,
    color: "#111827",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
  },
  label: { width: "38%", color: "#6b7280" },
  value: { width: "62%" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "30%", borderWidth: 1, borderColor: "#d1d5db", padding: 8 },
  metricValue: { fontSize: 16, fontWeight: 700, marginTop: 3 },
  control: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 9,
    marginBottom: 8,
  },
  controlTitle: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  small: { color: "#4b5563", marginTop: 2 },
  watermark: {
    position: "absolute",
    top: 18,
    right: 42,
    fontSize: 9,
    fontWeight: 700,
    color: "#9ca3af",
    letterSpacing: 2,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 42,
    right: 42,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 8,
  },
});

function formatDate(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "Not recorded";
}

export function getAssessmentReportPdfText(report: AssessmentReport): string[] {
  return [
    "Internal Assessment Review Report",
    report.vendor.legal_name,
    report.assessment.template_name,
    ...report.sections.map(
      (section) =>
        `${section.title}: ${section.compliant} compliant, ${section.non_compliant} non-compliant, ${section.unmarked} unmarked`,
    ),
    ...report.controls
      .filter((control) => control.verdict === "non_compliant")
      .flatMap((control) => [
        control.control_id,
        control.question,
        control.reviewer_note,
        ...control.linked_risks.map(
          (risk) => `${risk.title} (${risk.severity})`,
        ),
      ]),
  ];
}

export function AssessmentReportDocument({
  report,
}: {
  report: AssessmentReport;
}) {
  const nonCompliant = report.controls.filter(
    (control) => control.verdict === "non_compliant",
  );
  const summary = report.summary;
  return (
    <Document
      title={`${report.vendor.legal_name} assessment review`}
      author={report.workspace.name}
    >
      <Page size="A4" style={styles.page}>
        <Text fixed style={styles.watermark}>
          INTERNAL
        </Text>
        <Text style={styles.title}>Internal Assessment Review Report</Text>
        <Text style={styles.subtitle}>
          {report.vendor.legal_name} · {report.engagement.business_unit}
        </Text>
        {[
          ["Workspace", report.workspace.name],
          [
            "Vendor tier",
            report.vendor.tier ? `Tier ${report.vendor.tier}` : "Unscored",
          ],
          [
            "Template",
            `${report.assessment.template_name} v${report.assessment.template_version}`,
          ],
          ["Review round", String(report.assessment.review_round)],
          ["Assigned", formatDate(report.assessment.assigned_at)],
          ["Submitted", formatDate(report.assessment.submitted_at)],
          ["Reviewed", formatDate(report.assessment.reviewed_at)],
          ["Reviewer(s)", report.reviewers.join(", ") || "Not recorded"],
          ["Next review due", formatDate(summary.next_review_due)],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
        <Text style={styles.heading}>Review summary</Text>
        <View style={styles.metricGrid}>
          {[
            [
              "Reviewed",
              `${summary.controls.reviewed}/${summary.controls.total}`,
            ],
            ["Compliant", summary.controls.compliant],
            ["Non-compliant", summary.controls.non_compliant],
            ["Risks", summary.risks.total],
            ["Insufficient evidence", summary.insufficient_evidence.count],
            ["Incomplete CAP tasks", summary.cap_completeness.incomplete_tasks],
          ].map(([label, value]) => (
            <View key={label} style={styles.metric}>
              <Text>{label}</Text>
              <Text style={styles.metricValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Internal · ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
      <Page size="A4" style={styles.page} wrap>
        <Text fixed style={styles.watermark}>
          INTERNAL
        </Text>
        <Text style={styles.title}>Section breakdown</Text>
        {report.sections.map((section) => (
          <View key={section.title} style={styles.row}>
            <Text style={styles.label}>{section.title}</Text>
            <Text style={styles.value}>
              {section.total} controls · {section.compliant} compliant ·{" "}
              {section.non_compliant} non-compliant · {section.unmarked}{" "}
              unmarked
            </Text>
          </View>
        ))}
        <Text style={styles.heading}>Non-compliant controls</Text>
        {nonCompliant.length === 0 ? (
          <Text>No non-compliant controls were recorded.</Text>
        ) : (
          nonCompliant.map((control) => (
            <View key={control.control_id} style={styles.control} wrap={false}>
              <Text style={styles.controlTitle}>
                {control.control_id} · {control.question}
              </Text>
              <Text style={styles.small}>
                Reviewer note: {control.reviewer_note || "None"}
              </Text>
              <Text style={styles.small}>
                Risks:{" "}
                {control.linked_risks
                  .map((risk) => `${risk.title} (${risk.severity})`)
                  .join(", ") || "None"}
              </Text>
            </View>
          ))
        )}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Internal · ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export function renderAssessmentReportPdf(
  report: AssessmentReport,
): Promise<Buffer> {
  return renderToBuffer(<AssessmentReportDocument report={report} />);
}
