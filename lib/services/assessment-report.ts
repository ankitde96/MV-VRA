import { Types } from "mongoose";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { ResponseRepository } from "@/lib/repositories/response-repository";
import { RiskRepository } from "@/lib/repositories/risk-repository";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { WorkspaceRepository } from "@/lib/repositories/workspace-repository";
import { User } from "@/lib/db/models/user";
import { NotFoundError } from "@/lib/errors";
import {
  computeVisibility,
  type AnswersMap,
} from "@/lib/questionnaire/evaluator";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export interface CapCompletenessIssue {
  risk_id: string;
  risk_title: string;
  task_id: string;
  task_description: string;
  missing_fields: Array<"owner" | "due_date">;
}

export interface CapCompletenessSummary {
  incomplete_tasks: number;
  issues: CapCompletenessIssue[];
}

export interface AssessmentCompletionSummary {
  controls: {
    reviewed: number;
    total: number;
    compliant: number;
    non_compliant: number;
    unmarked: number;
    suppressed: number;
  };
  blockers: {
    unmarked_control_ids: string[];
    non_compliant_without_risk_control_ids: string[];
  };
  risks: {
    total: number;
    by_severity: Record<"critical" | "high" | "medium" | "low", number>;
  };
  cap_completeness: CapCompletenessSummary;
  insufficient_evidence: { count: number; control_ids: string[] };
  next_review_due: string | null;
  can_complete: boolean;
}

export interface AssessmentReportControl {
  control_id: string;
  section: string;
  question: string;
  response: unknown;
  verdict: "compliant" | "non_compliant" | null;
  reviewer_note: string;
  reviewer: string | null;
  evidence: Array<{
    filename: string;
    mime: string;
    size: number;
    insufficient: boolean;
    insufficiency_note: string;
  }>;
  linked_risks: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  suppressed: boolean;
}

export interface AssessmentReport {
  generated_at: string;
  assessment: {
    id: string;
    template_name: string;
    template_version: number;
    review_round: number;
    status: string;
    assigned_at: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  };
  workspace: { name: string };
  vendor: { legal_name: string; tier: number | null };
  engagement: { business_unit: string };
  reviewers: string[];
  controls: AssessmentReportControl[];
  sections: Array<{
    title: string;
    total: number;
    compliant: number;
    non_compliant: number;
    unmarked: number;
  }>;
  summary: AssessmentCompletionSummary;
}

export function getCapCompletenessSummary(
  risks: Array<{ _id: Types.ObjectId; title: string; cap_tasks?: unknown[] }>,
): CapCompletenessSummary {
  const issues: CapCompletenessIssue[] = [];
  for (const risk of risks) {
    for (const rawTask of risk.cap_tasks ?? []) {
      const task = rawTask as {
        task_id?: Types.ObjectId;
        description?: string;
        owner_type?: string;
        owner_ref?: Types.ObjectId;
        due_date?: Date;
      };
      const missingFields: CapCompletenessIssue["missing_fields"] = [];
      if (!(
        ["internal", "vendor"].includes(task.owner_type ?? "") && task.owner_ref
      )) {
        missingFields.push("owner");
      }
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      if (!dueDate || Number.isNaN(dueDate.getTime()))
        missingFields.push("due_date");
      if (missingFields.length) {
        issues.push({
          risk_id: risk._id.toString(),
          risk_title: risk.title,
          task_id: task.task_id?.toString() ?? "unknown",
          task_description: task.description ?? "Corrective action task",
          missing_fields: missingFields,
        });
      }
    }
  }
  return { incomplete_tasks: issues.length, issues };
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replace(/"/g, '""')}"`
    : safeValue;
}

function responseText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function buildAssessmentReportCsv(report: AssessmentReport): string {
  const rows = [
    [
      "Control ID",
      "Section",
      "Question",
      "Response",
      "Verdict",
      "Reviewer Note",
      "Evidence Count",
      "Insufficiency Flags",
      "Linked Risk IDs",
      "Linked Risk Severities",
    ],
    ...report.controls.map((control) => [
      control.control_id,
      control.section,
      control.question,
      responseText(control.response),
      control.verdict ?? "unmarked",
      control.reviewer_note,
      String(control.evidence.length),
      control.evidence
        .filter((item) => item.insufficient)
        .map(
          (item) =>
            `${item.filename}: ${item.insufficiency_note || "Insufficient"}`,
        )
        .join("; "),
      control.linked_risks.map((risk) => risk.id).join("; "),
      control.linked_risks.map((risk) => risk.severity).join("; "),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\r\n")}\r\n`;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export class AssessmentReportService {
  private assessmentRepo: AssessmentRepository;
  private vendorRepo: VendorRepository;
  private engagementRepo: EngagementRepository;
  private responseRepo: ResponseRepository;
  private riskRepo: RiskRepository;
  private workspaceRepo = new WorkspaceRepository();

  constructor(private ctx: TenantContext) {
    this.assessmentRepo = new AssessmentRepository(ctx);
    this.vendorRepo = new VendorRepository(ctx);
    this.engagementRepo = new EngagementRepository(ctx);
    this.responseRepo = new ResponseRepository(ctx);
    this.riskRepo = new RiskRepository(ctx);
  }

  async getReport(
    assessmentId: string,
    asOf = new Date(),
  ): Promise<AssessmentReport> {
    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment)
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    const [vendor, engagement, responses, risks, workspace] = await Promise.all(
      [
        this.vendorRepo.findById(assessment.vendor_id).lean(),
        this.engagementRepo.findById(assessment.engagement_id).lean(),
        this.responseRepo.findByAssessment(assessmentId).lean(),
        this.riskRepo.find({ assessment_id: assessment._id }).lean(),
        this.workspaceRepo.findById(this.ctx.workspaceId).lean(),
      ],
    );
    if (!vendor || !engagement)
      throw new NotFoundError(
        `Vendor or engagement not found for assessment: ${assessmentId}`,
      );

    const reviewerIds = [
      ...new Set(
        responses
          .map((item) => item.reviewed_by?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const reviewerUsers = reviewerIds.length
      ? await User.find({
          _id: { $in: reviewerIds.map(toObjectId) },
          memberships: {
            $elemMatch: { workspace_id: toObjectId(this.ctx.workspaceId) },
          },
        })
          .select({ _id: 1, name: 1 })
          .lean()
      : [];
    const reviewerById = new Map(
      reviewerUsers.map((user) => [user._id.toString(), user.name]),
    );
    const responseByControl = new Map(
      responses.map((item) => [item.control_id, item]),
    );
    const risksByControl = new Map<string, typeof risks>();
    risks.forEach((risk) =>
      risksByControl.set(risk.control_id, [
        ...(risksByControl.get(risk.control_id) ?? []),
        risk,
      ]),
    );
    const schema = assessment.template_snapshot as QuestionsSchema;
    const answers = Object.fromEntries(
      responses.map((item) => [item.control_id, item.response_value]),
    ) as AnswersMap;
    const visibility = computeVisibility(schema, answers);
    const controls: AssessmentReportControl[] = [];
    for (const section of schema.sections) {
      for (const question of section.questions) {
        const response = responseByControl.get(question.control_id);
        const flaggedIds = new Map(
          response?.evidence_flags.map((flag) => [
            flag.evidence_id.toString(),
            flag.note,
          ]) ?? [],
        );
        controls.push({
          control_id: question.control_id,
          section: section.title,
          question: question.text,
          response: response?.response_value ?? null,
          verdict: response?.review_status ?? null,
          reviewer_note: response?.reviewer_note ?? "",
          reviewer: response?.reviewed_by
            ? (reviewerById.get(response.reviewed_by.toString()) ??
              "Unknown reviewer")
            : null,
          evidence: (response?.evidence ?? []).map((item) => ({
            filename: item.filename,
            mime: item.mime,
            size: item.size,
            insufficient: flaggedIds.has(item._id!.toString()),
            insufficiency_note: flaggedIds.get(item._id!.toString()) ?? "",
          })),
          linked_risks: (risksByControl.get(question.control_id) ?? []).map(
            (risk) => ({
              id: risk._id.toString(),
              title: risk.title,
              severity: risk.severity,
              status: risk.status,
            }),
          ),
          suppressed: visibility.get(question.control_id) === false,
        });
      }
    }
    const visible = controls.filter((control) => !control.suppressed);
    const unmarked = visible
      .filter((control) => !control.verdict)
      .map((control) => control.control_id);
    const withoutRisk = visible
      .filter(
        (control) =>
          control.verdict === "non_compliant" &&
          control.linked_risks.length === 0,
      )
      .map((control) => control.control_id);
    const insufficientControlIds = [
      ...new Set(
        visible
          .filter((control) =>
            control.evidence.some((item) => item.insufficient),
          )
          .map((control) => control.control_id),
      ),
    ];
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach((risk) => {
      if (risk.severity in bySeverity)
        bySeverity[risk.severity as keyof typeof bySeverity]++;
    });
    const cadence = vendor.inherent_risk_tier
      ? workspace?.settings?.reassessment_cadence_months?.[
          `tier${vendor.inherent_risk_tier}` as "tier1" | "tier2" | "tier3"
        ]
      : undefined;
    const nextReviewDue =
      assessment.next_review_due ??
      (cadence ? addMonths(assessment.reviewed_at ?? asOf, cadence) : null);
    const capCompleteness = getCapCompletenessSummary(risks);
    const summary: AssessmentCompletionSummary = {
      controls: {
        reviewed: visible.length - unmarked.length,
        total: visible.length,
        compliant: visible.filter((item) => item.verdict === "compliant")
          .length,
        non_compliant: visible.filter(
          (item) => item.verdict === "non_compliant",
        ).length,
        unmarked: unmarked.length,
        suppressed: controls.length - visible.length,
      },
      blockers: {
        unmarked_control_ids: unmarked,
        non_compliant_without_risk_control_ids: withoutRisk,
      },
      risks: { total: risks.length, by_severity: bySeverity },
      cap_completeness: capCompleteness,
      insufficient_evidence: {
        count: insufficientControlIds.length,
        control_ids: insufficientControlIds,
      },
      next_review_due: nextReviewDue?.toISOString() ?? null,
      can_complete: unmarked.length === 0 && withoutRisk.length === 0,
    };
    return {
      generated_at: asOf.toISOString(),
      assessment: {
        id: assessment._id.toString(),
        template_name: assessment.template_name ?? "Vendor assessment",
        template_version: assessment.template_version,
        review_round: assessment.review_round ?? 0,
        status: assessment.status,
        assigned_at: assessment.assigned_at?.toISOString() ?? null,
        submitted_at: assessment.submitted_at?.toISOString() ?? null,
        reviewed_at: assessment.reviewed_at?.toISOString() ?? null,
      },
      workspace: { name: workspace?.entity_name ?? "Workspace" },
      vendor: {
        legal_name: vendor.legal_name,
        tier: vendor.inherent_risk_tier ?? null,
      },
      engagement: { business_unit: engagement.business_unit },
      reviewers: [...new Set(reviewerUsers.map((user) => user.name))],
      controls,
      sections: schema.sections.map((section) => {
        const items = visible.filter(
          (control) => control.section === section.title,
        );
        return {
          title: section.title,
          total: items.length,
          compliant: items.filter((item) => item.verdict === "compliant")
            .length,
          non_compliant: items.filter(
            (item) => item.verdict === "non_compliant",
          ).length,
          unmarked: items.filter((item) => !item.verdict).length,
        };
      }),
      summary,
    };
  }
}
