import { Types } from "mongoose";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { ResponseRepository } from "@/lib/repositories/response-repository";
import { RiskRepository } from "@/lib/repositories/risk-repository";
import { WorkspaceRepository } from "@/lib/repositories/workspace-repository";
import { MitigationGuidance } from "@/lib/db/models/mitigation-guidance";
import { User } from "@/lib/db/models/user";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import {
  computeVisibility,
  isAnswered,
  type AnswersMap,
} from "@/lib/questionnaire/evaluator";
import {
  calculateResidualScore,
  type RiskSeverity,
  type RiskImpactLevel,
} from "@/lib/scoring/residual-risk";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getMailer } from "@/lib/mail";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export const DEFAULT_ENTERPRISE_RISK_CATEGORIES = [
  "Information Security",
  "Data Privacy & Protection",
  "Operational Resilience",
  "Third-Party Compliance",
  "Business Continuity",
  "Cloud & Infrastructure Security",
];

/**
 * PLAN.md Phase 10, `CONSTRAINTS.md` #12 — once `completeOffboarding()`
 * (`lib/services/offboarding.ts`) archives an assessment, its risks and CAP tasks are
 * "remediation logs" too and must become append-only with it. Nothing before Phase 10
 * needed this check because nothing could archive an assessment yet.
 */
function assertAssessmentNotArchived(status: string): void {
  if (status === "archived") {
    throw new ForbiddenError(
      "This assessment is archived and its risks can no longer be modified",
    );
  }
}

function resolveActorId(
  actorIdOrEmail: string | Types.ObjectId,
): Types.ObjectId | null {
  if (actorIdOrEmail instanceof Types.ObjectId) return actorIdOrEmail;
  if (
    typeof actorIdOrEmail === "string" &&
    Types.ObjectId.isValid(actorIdOrEmail)
  ) {
    return toObjectId(actorIdOrEmail);
  }
  return null;
}

export interface RaiseRiskInput {
  control_id: string;
  title: string;
  description?: string;
  severity: RiskSeverity;
  enterprise_risk_category: string;
  impact_level: RiskImpactLevel;
  compensating_controls?: string[];
}

export interface UpdateRiskInput {
  title?: string;
  description?: string;
  severity?: RiskSeverity;
  enterprise_risk_category?: string;
  impact_level?: RiskImpactLevel;
  compensating_controls?: string[];
  status?: "open" | "mitigating" | "accepted" | "closed";
}

export type CapTaskOwnerType = "internal" | "vendor";
export type CapTaskStatus = "open" | "in_progress" | "overdue" | "closed";

export interface CreateCapTaskInput {
  description: string;
  owner_type: CapTaskOwnerType;
  // Required when owner_type is 'internal' (a User._id). Ignored when owner_type is
  // 'vendor' — a CAP task always remediates the risk's own vendor, there is no scenario
  // where it should name a different one, so the risk's vendor_id is used regardless of
  // what the caller sends.
  owner_ref?: string;
  due_date: string | Date;
}

export interface UpdateCapTaskInput {
  description?: string;
  due_date?: string | Date;
  status?: CapTaskStatus;
}

export interface OverdueCapQueueItem {
  risk_id: string;
  task_id: string;
  risk_title: string;
  control_id: string;
  vendor_id: string;
  vendor_name: string;
  description: string;
  owner_type: CapTaskOwnerType;
  owner_label: string;
  due_date: string;
  status: CapTaskStatus;
  escalated_at: string | null;
  newly_escalated: boolean;
}

export interface ReviewerQuestionItem {
  control_id: string;
  text: string;
  type: string;
  section_title: string;
  is_required: boolean;
  response_value: unknown;
  evidence: Array<{
    id: string;
    filename: string;
    mime: string;
    size: number;
    download_url: string;
  }>;
  is_suppressed: boolean;
  control_status: "passed" | "exception" | "failed" | "missing" | "suppressed";
  suggested_guidance?: {
    failure_condition: string;
    suggested_remediation: string;
  };
  associated_risks: Array<{
    id: string;
    title: string;
    severity: string;
    residual_score: number;
    status: string;
  }>;
}

export class AssessmentReviewService {
  private assessmentRepo: AssessmentRepository;
  private vendorRepo: VendorRepository;
  private engagementRepo: EngagementRepository;
  private responseRepo: ResponseRepository;
  private riskRepo: RiskRepository;
  private workspaceRepo: WorkspaceRepository;

  constructor(private ctx: TenantContext) {
    this.assessmentRepo = new AssessmentRepository(ctx);
    this.vendorRepo = new VendorRepository(ctx);
    this.engagementRepo = new EngagementRepository(ctx);
    this.responseRepo = new ResponseRepository(ctx);
    this.riskRepo = new RiskRepository(ctx);
    this.workspaceRepo = new WorkspaceRepository();
  }

  /**
   * Fetches full assessment review data for internal reviewers.
   * DECISIONS.md 020: Recomputes question visibility live using `computeVisibility()`.
   */
  async getAssessmentReviewData(assessmentId: string) {
    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    }

    const [vendor, engagement, responses, risks, workspace, guidanceList] =
      await Promise.all([
        this.vendorRepo.findById(assessment.vendor_id).lean(),
        this.engagementRepo.findById(assessment.engagement_id).lean(),
        this.responseRepo.findByAssessment(assessmentId).lean(),
        this.riskRepo.find({ assessment_id: assessment._id }).lean(),
        this.workspaceRepo.findById(this.ctx.workspaceId).lean(),
        MitigationGuidance.find().lean(),
      ]);

    if (!vendor || !engagement) {
      throw new NotFoundError(
        `Vendor or engagement not found for assessment: ${assessmentId}`,
      );
    }

    // Build answers map for evaluator
    const answersMap: AnswersMap = {};
    const responsesByControl = new Map<string, (typeof responses)[number]>();
    for (const resp of responses) {
      answersMap[resp.control_id] = resp.response_value as AnswersMap[string];
      responsesByControl.set(resp.control_id, resp);
    }

    // Recompute visibility live (DECISIONS.md 020)
    const schema = assessment.template_snapshot as QuestionsSchema;
    const visibilityMap = computeVisibility(schema, answersMap);

    const risksByControl = new Map<string, typeof risks>();
    for (const r of risks) {
      risksByControl.set(r.control_id, [
        ...(risksByControl.get(r.control_id) ?? []),
        r,
      ]);
    }

    const questionItems: ReviewerQuestionItem[] = [];
    let totalCount = 0;
    let answeredCount = 0;
    let passedCount = 0;
    let exceptionCount = 0;
    let failedCount = 0;
    let missingCount = 0;
    let suppressedCount = 0;

    for (const section of schema.sections) {
      for (const q of section.questions) {
        totalCount++;
        const isSuppressed = visibilityMap.get(q.control_id) === false;
        const resp = responsesByControl.get(q.control_id);
        const hasAnswer = isAnswered(resp?.response_value);

        if (isSuppressed) {
          suppressedCount++;
        } else if (hasAnswer) {
          answeredCount++;
        } else if (q.required) {
          missingCount++;
        }

        const controlRisks = risksByControl.get(q.control_id) ?? [];

        // Determine control status
        let controlStatus: ReviewerQuestionItem["control_status"] = "passed";
        if (isSuppressed) {
          controlStatus = "suppressed";
        } else if (q.required && !hasAnswer) {
          controlStatus = "missing";
        } else if (resp?.has_exception) {
          controlStatus = "exception";
          exceptionCount++;
        } else if (resp?.is_failed || controlRisks.length > 0) {
          controlStatus = "failed";
          failedCount++;
        } else if (hasAnswer) {
          passedCount++;
        }

        // Find suggested guidance for failed/exception controls
        let suggestedGuidance: ReviewerQuestionItem["suggested_guidance"] =
          undefined;
        if (
          controlStatus === "failed" ||
          controlStatus === "exception" ||
          controlStatus === "missing"
        ) {
          const matched = guidanceList.find((g) => {
            if (g.control_pattern.endsWith("*")) {
              const prefix = g.control_pattern.slice(0, -1);
              return q.control_id.startsWith(prefix);
            }
            return g.control_pattern === q.control_id;
          });
          if (matched) {
            suggestedGuidance = {
              failure_condition: matched.failure_condition,
              suggested_remediation: matched.suggested_remediation,
            };
          }
        }

        questionItems.push({
          control_id: q.control_id,
          text: q.text,
          type: q.type,
          section_title: section.title,
          is_required: q.required,
          response_value: resp?.response_value ?? null,
          evidence: (resp?.evidence ?? []).map((e) => ({
            id: e._id!.toString(),
            filename: e.filename,
            mime: e.mime,
            size: e.size,
            download_url: `/api/portal/assessments/${assessmentId}/responses/${q.control_id}/evidence/${e._id!.toString()}`,
          })),
          is_suppressed: isSuppressed,
          control_status: controlStatus,
          suggested_guidance: suggestedGuidance,
          associated_risks: controlRisks.map((r) => ({
            id: r._id.toString(),
            title: r.title,
            severity: r.severity,
            residual_score: r.residual_score,
            status: r.status,
          })),
        });
      }
    }

    const categories = workspace?.settings?.enterprise_risk_categories ?? [];
    const useProvisionalTaxonomy = categories.length === 0;
    const enterpriseRiskCategories = useProvisionalTaxonomy
      ? DEFAULT_ENTERPRISE_RISK_CATEGORIES
      : categories;

    return {
      assessment: {
        id: assessment._id.toString(),
        status: assessment.status,
        template_version: assessment.template_version,
        overall_score: assessment.overall_score,
        assigned_at: assessment.assigned_at?.toISOString() ?? null,
        submitted_at: assessment.submitted_at?.toISOString() ?? null,
        reviewed_at: assessment.reviewed_at?.toISOString() ?? null,
      },
      vendor: {
        id: vendor._id.toString(),
        legal_name: vendor.legal_name,
        domain: vendor.domain,
      },
      engagement: {
        id: engagement._id.toString(),
        business_unit: engagement.business_unit,
        inherent_risk_score: engagement.inherent_score?.total ?? null,
        inherent_risk_tier: engagement.inherent_risk_tier,
      },
      questions: questionItems,
      risks: risks.map((r) => ({
        id: r._id.toString(),
        control_id: r.control_id,
        title: r.title,
        description: r.description,
        severity: r.severity,
        enterprise_risk_category: r.enterprise_risk_category,
        impact_level: r.impact_level,
        residual_score: r.residual_score,
        residual_inputs: r.residual_inputs,
        status: r.status,
      })),
      enterprise_risk_categories: enterpriseRiskCategories,
      is_provisional_taxonomy: useProvisionalTaxonomy,
      metrics: {
        total: totalCount,
        answered: answeredCount,
        passed: passedCount,
        exception: exceptionCount,
        failed: failedCount,
        missing: missingCount,
        suppressed: suppressedCount,
        risks_count: risks.length,
      },
    };
  }

  /**
   * Raises an Identified Risk against a control in an assessment.
   * DECISIONS.md 008: `risk.residual_score` is authoritative and computed on write.
   * `assessment.overall_score` is derived as the sum of constituent risks and recomputed in the same write.
   */
  async raiseRisk(
    assessmentId: string,
    input: RaiseRiskInput,
    actorIdOrEmail: string | Types.ObjectId = "internal@mv-vra.local",
  ) {
    if (
      !input.control_id ||
      !input.title ||
      !input.severity ||
      !input.enterprise_risk_category ||
      !input.impact_level
    ) {
      throw new ValidationError(
        "Missing required risk fields: control_id, title, severity, category, impact_level",
      );
    }

    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    }
    assertAssessmentNotArchived(assessment.status);

    const engagement = await this.engagementRepo
      .findById(assessment.engagement_id)
      .lean();

    const scoringResult = calculateResidualScore({
      severity: input.severity,
      impact_level: input.impact_level,
      inherent_score: engagement?.inherent_score?.total ?? null,
      compensating_controls: input.compensating_controls,
    });

    const createdRisk = await this.riskRepo.create({
      assessment_id: assessment._id,
      engagement_id: assessment.engagement_id,
      vendor_id: assessment.vendor_id,
      control_id: input.control_id,
      title: input.title,
      description: input.description ?? "",
      severity: input.severity,
      enterprise_risk_category: input.enterprise_risk_category,
      impact_level: input.impact_level,
      residual_score: scoringResult.residual_score,
      residual_inputs: scoringResult.residual_inputs,
      cap_tasks: [],
      status: "open",
    });

    // Recompute assessment overall score as sum of all constituent risks' residual_scores
    const allRisks = await this.riskRepo
      .find({ assessment_id: assessment._id })
      .lean();
    const newOverallScore = allRisks.reduce(
      (sum, r) => sum + r.residual_score,
      0,
    );

    const updatePayload: { overall_score: number; status?: string } = {
      overall_score: newOverallScore,
    };
    if (assessment.status === "submitted") {
      updatePayload.status = "under_review";
    }

    await this.assessmentRepo.updateOne(
      { _id: assessment._id },
      { $set: updatePayload },
    );

    await recordAuditEvent({
      workspace_id: toObjectId(this.ctx.workspaceId),
      actor: {
        type: "internal",
        id: resolveActorId(actorIdOrEmail),
        email: typeof actorIdOrEmail === "string" ? actorIdOrEmail : null,
      },
      action: "risk.created",
      entity_type: "Risk",
      entity_id: createdRisk._id,
      diff: {
        control_id: input.control_id,
        residual_score: scoringResult.residual_score,
      },
    });

    return {
      risk_id: createdRisk._id.toString(),
      residual_score: scoringResult.residual_score,
      overall_score: newOverallScore,
    };
  }

  /**
   * Updates an existing Identified Risk and recomputes residual & assessment overall scores.
   */
  async updateRisk(
    riskId: string,
    input: UpdateRiskInput,
    actorIdOrEmail: string | Types.ObjectId = "internal@mv-vra.local",
  ) {
    const risk = await this.riskRepo.findById(riskId).lean();
    if (!risk) {
      throw new NotFoundError(`Risk not found: ${riskId}`);
    }
    const parentAssessment = await this.assessmentRepo
      .findById(risk.assessment_id)
      .lean();
    assertAssessmentNotArchived(parentAssessment?.status ?? "");

    const engagement = await this.engagementRepo
      .findById(risk.engagement_id)
      .lean();

    const newSeverity = input.severity ?? risk.severity;
    const newImpact = input.impact_level ?? risk.impact_level;
    const newControls =
      input.compensating_controls ??
      (risk.residual_inputs?.compensating_controls as string[] | undefined) ??
      [];

    const scoringResult = calculateResidualScore({
      severity: newSeverity as RiskSeverity,
      impact_level: newImpact as RiskImpactLevel,
      inherent_score: engagement?.inherent_score?.total ?? null,
      compensating_controls: newControls,
    });

    const updateFields: Record<string, unknown> = {
      residual_score: scoringResult.residual_score,
      residual_inputs: scoringResult.residual_inputs,
    };

    if (input.title !== undefined) updateFields.title = input.title;
    if (input.description !== undefined)
      updateFields.description = input.description;
    if (input.severity !== undefined) updateFields.severity = input.severity;
    if (input.enterprise_risk_category !== undefined)
      updateFields.enterprise_risk_category = input.enterprise_risk_category;
    if (input.impact_level !== undefined)
      updateFields.impact_level = input.impact_level;
    if (input.status !== undefined) updateFields.status = input.status;

    await this.riskRepo.updateOne({ _id: risk._id }, { $set: updateFields });

    // Recompute assessment overall score
    const allRisks = await this.riskRepo
      .find({ assessment_id: risk.assessment_id })
      .lean();
    const newOverallScore = allRisks.reduce(
      (sum, r) => sum + r.residual_score,
      0,
    );

    await this.assessmentRepo.updateOne(
      { _id: risk.assessment_id },
      { $set: { overall_score: newOverallScore } },
    );

    await recordAuditEvent({
      workspace_id: toObjectId(this.ctx.workspaceId),
      actor: {
        type: "internal",
        id: resolveActorId(actorIdOrEmail),
        email: typeof actorIdOrEmail === "string" ? actorIdOrEmail : null,
      },
      action: "risk.updated",
      entity_type: "Risk",
      entity_id: risk._id,
      diff: updateFields,
    });

    return {
      risk_id: risk._id.toString(),
      residual_score: scoringResult.residual_score,
      overall_score: newOverallScore,
    };
  }

  /**
   * Creates a CAP (corrective action plan) task on an existing risk — PLAN.md Phase 9 item
   * 1. `cap_tasks` stays embedded on the risk (DECISIONS.md 006); this only ever appends,
   * never rewrites an existing task, so two CAP tasks created moments apart on the same
   * risk cannot clobber one another (`RiskRepository.pushCapTask()`'s `$push`).
   */
  async createCapTask(
    riskId: string,
    input: CreateCapTaskInput,
    actorIdOrEmail: string | Types.ObjectId = "internal@mv-vra.local",
  ) {
    if (!input.description?.trim() || !input.owner_type || !input.due_date) {
      throw new ValidationError(
        "Missing required CAP task fields: description, owner_type, due_date",
      );
    }

    const dueDate = new Date(input.due_date);
    if (isNaN(dueDate.getTime())) {
      throw new ValidationError("due_date is not a valid date");
    }

    const risk = await this.riskRepo.findById(riskId).lean();
    if (!risk) {
      throw new NotFoundError(`Risk not found: ${riskId}`);
    }
    const parentAssessment = await this.assessmentRepo
      .findById(risk.assessment_id)
      .lean();
    assertAssessmentNotArchived(parentAssessment?.status ?? "");

    let ownerRef: Types.ObjectId;
    if (input.owner_type === "vendor") {
      // Always the risk's own vendor — see CreateCapTaskInput's comment on owner_ref.
      ownerRef = risk.vendor_id;
    } else if (input.owner_type === "internal") {
      if (!input.owner_ref || !Types.ObjectId.isValid(input.owner_ref)) {
        throw new ValidationError(
          "owner_ref must be a valid User id when owner_type is internal",
        );
      }
      const owner = await User.findById(input.owner_ref).lean();
      if (!owner || owner.status !== "active") {
        throw new ValidationError(
          "owner_ref does not resolve to an active internal user",
        );
      }
      ownerRef = toObjectId(input.owner_ref);
    } else {
      throw new ValidationError(`Unknown owner_type: ${input.owner_type}`);
    }

    const taskId = new Types.ObjectId();
    await this.riskRepo.pushCapTask(risk._id, {
      task_id: taskId,
      description: input.description.trim(),
      owner_type: input.owner_type,
      owner_ref: ownerRef,
      due_date: dueDate,
      status: "open",
      closed_at: null,
      escalated_at: null,
    });

    await recordAuditEvent({
      workspace_id: toObjectId(this.ctx.workspaceId),
      actor: {
        type: "internal",
        id: resolveActorId(actorIdOrEmail),
        email: typeof actorIdOrEmail === "string" ? actorIdOrEmail : null,
      },
      action: "risk.cap_task_created",
      entity_type: "Risk",
      entity_id: risk._id,
      diff: {
        task_id: taskId.toString(),
        owner_type: input.owner_type,
        due_date: dueDate,
      },
    });

    return {
      risk_id: risk._id.toString(),
      task_id: taskId.toString(),
      status: "open" as CapTaskStatus,
      due_date: dueDate.toISOString(),
    };
  }

  /**
   * Updates a CAP task's description, due date, or status. Setting status to `closed` also
   * stamps `closed_at` — the one field this service writes automatically rather than taking
   * it from the caller, so "closed" always carries a real timestamp.
   */
  async updateCapTask(
    riskId: string,
    taskId: string,
    input: UpdateCapTaskInput,
    actorIdOrEmail: string | Types.ObjectId = "internal@mv-vra.local",
  ) {
    const risk = await this.riskRepo.findById(riskId).lean();
    if (!risk) {
      throw new NotFoundError(`Risk not found: ${riskId}`);
    }
    const parentAssessment = await this.assessmentRepo
      .findById(risk.assessment_id)
      .lean();
    assertAssessmentNotArchived(parentAssessment?.status ?? "");

    const task = risk.cap_tasks?.find((t) => t.task_id?.toString() === taskId);
    if (!task) {
      throw new NotFoundError(`CAP task not found: ${taskId}`);
    }

    const fields: Record<string, unknown> = {};
    if (input.description !== undefined)
      fields.description = input.description.trim();
    if (input.due_date !== undefined) {
      const dueDate = new Date(input.due_date);
      if (isNaN(dueDate.getTime())) {
        throw new ValidationError("due_date is not a valid date");
      }
      fields.due_date = dueDate;
    }
    if (input.status !== undefined) {
      fields.status = input.status;
      fields.closed_at = input.status === "closed" ? new Date() : null;
    }

    if (Object.keys(fields).length === 0) {
      throw new ValidationError("No updatable fields provided");
    }

    await this.riskRepo.updateCapTaskFields(risk._id, taskId, fields);

    await recordAuditEvent({
      workspace_id: toObjectId(this.ctx.workspaceId),
      actor: {
        type: "internal",
        id: resolveActorId(actorIdOrEmail),
        email: typeof actorIdOrEmail === "string" ? actorIdOrEmail : null,
      },
      action: "risk.cap_task_updated",
      entity_type: "Risk",
      entity_id: risk._id,
      diff: { task_id: taskId, ...fields },
    });

    return { risk_id: risk._id.toString(), task_id: taskId, ...fields };
  }

  /**
   * Request-driven overdue detection and one-time escalation — PLAN.md Phase 9 item 2,
   * deliberately with no background job runner (`PLAN.md` §1's stated default for this
   * open question). Called on every load of the overdue queue view, so it must be safe to
   * run repeatedly: a task already flagged `overdue` is not re-flagged, and a task that has
   * already sent one escalation (`escalated_at` set) never sends a second, however many
   * times this runs — that's what makes "escalates once" true without a scheduler.
   */
  async detectAndEscalateOverdueCaps(
    actorIdOrEmail: string | Types.ObjectId = "system@mv-vra.local",
  ): Promise<OverdueCapQueueItem[]> {
    const now = new Date();
    const risks = await this.riskRepo.findRisksWithPastDueCapTasks(now).lean();
    if (risks.length === 0) return [];

    const vendorIds = [...new Set(risks.map((r) => r.vendor_id.toString()))];
    const vendors = await this.vendorRepo
      .find({ _id: { $in: vendorIds.map((id) => new Types.ObjectId(id)) } })
      .lean();
    const vendorById = new Map(vendors.map((v) => [v._id.toString(), v]));

    const items: OverdueCapQueueItem[] = [];

    for (const risk of risks) {
      const vendor = vendorById.get(risk.vendor_id.toString());

      for (const task of risk.cap_tasks ?? []) {
        // task_id is `auto: true`, not `required` at the type level — every task pushed by
        // createCapTask() always has one, but a defensive skip is cheap and keeps the
        // updateCapTaskFields() call below correctly typed.
        if (!task.task_id) continue;
        const isPastDue = task.due_date < now && task.status !== "closed";
        if (!isPastDue) continue;

        const needsStatusFlip = task.status !== "overdue";
        const needsEscalation = !task.escalated_at;
        const escalatedAt = needsEscalation ? now : (task.escalated_at ?? null);

        if (needsStatusFlip || needsEscalation) {
          const fields: Record<string, unknown> = {};
          if (needsStatusFlip) fields.status = "overdue";
          if (needsEscalation) fields.escalated_at = now;
          await this.riskRepo.updateCapTaskFields(
            risk._id,
            task.task_id,
            fields,
          );
        }

        let ownerEmail: string | null = null;
        let ownerLabel = "Unknown owner";
        if (task.owner_type === "vendor") {
          ownerEmail = vendor?.spoc?.spoc_email ?? null;
          ownerLabel = vendor ? `${vendor.legal_name} (SPOC)` : "Vendor SPOC";
        } else {
          const owner = await User.findById(task.owner_ref).lean();
          ownerEmail = owner?.email ?? null;
          ownerLabel = owner?.name ?? "Internal owner";
        }

        if (needsEscalation && ownerEmail) {
          await getMailer().send({
            to: ownerEmail,
            subject: `[MV-VRA] Overdue corrective action: ${risk.title}`,
            text: `The corrective action "${task.description}" for the risk "${risk.title}" (control ${risk.control_id}, ${vendor?.legal_name ?? "unknown vendor"}) was due ${new Date(task.due_date).toDateString()} and is now overdue. Please update its status in the register.`,
          });

          await recordAuditEvent({
            workspace_id: toObjectId(this.ctx.workspaceId),
            actor: {
              type: "system",
              id: resolveActorId(actorIdOrEmail),
              email: typeof actorIdOrEmail === "string" ? actorIdOrEmail : null,
            },
            action: "risk.cap_task_escalated",
            entity_type: "Risk",
            entity_id: risk._id,
            diff: {
              task_id: task.task_id?.toString(),
              owner_email: ownerEmail,
            },
          });
        }

        items.push({
          risk_id: risk._id.toString(),
          task_id: task.task_id?.toString() ?? "",
          risk_title: risk.title,
          control_id: risk.control_id,
          vendor_id: risk.vendor_id.toString(),
          vendor_name: vendor?.legal_name ?? "Unknown Vendor",
          description: task.description,
          owner_type: task.owner_type as CapTaskOwnerType,
          owner_label: ownerLabel,
          due_date: new Date(task.due_date).toISOString(),
          status: (needsStatusFlip ? "overdue" : task.status) as CapTaskStatus,
          escalated_at: escalatedAt
            ? new Date(escalatedAt).toISOString()
            : null,
          newly_escalated: needsEscalation && Boolean(ownerEmail),
        });
      }
    }

    return items;
  }

  /**
   * Marks assessment review completed.
   */
  async completeReview(
    assessmentId: string,
    actorIdOrEmail: string | Types.ObjectId = "internal@mv-vra.local",
  ) {
    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    }

    await this.assessmentRepo.updateOne(
      { _id: assessment._id },
      { $set: { status: "completed", reviewed_at: new Date() } },
    );

    await recordAuditEvent({
      workspace_id: toObjectId(this.ctx.workspaceId),
      actor: {
        type: "internal",
        id: resolveActorId(actorIdOrEmail),
        email: typeof actorIdOrEmail === "string" ? actorIdOrEmail : null,
      },
      action: "assessment.reviewed",
      entity_type: "Assessment",
      entity_id: assessment._id,
    });

    return { ok: true, status: "completed" };
  }

  /**
   * Fetches all identified risks across the workspace (Risk Register).
   */
  async listWorkspaceRisks(filter?: {
    vendor_id?: string;
    severity?: string;
    status?: string;
    category?: string;
  }) {
    const queryFilter: Record<string, unknown> = {};
    if (filter?.vendor_id)
      queryFilter.vendor_id = new Types.ObjectId(filter.vendor_id);
    if (filter?.severity) queryFilter.severity = filter.severity;
    if (filter?.status) queryFilter.status = filter.status;
    if (filter?.category)
      queryFilter.enterprise_risk_category = filter.category;

    const risks = await this.riskRepo
      .find(queryFilter)
      .sort({ created_at: -1 })
      .lean();

    const vendorIds = [...new Set(risks.map((r) => r.vendor_id.toString()))];
    const vendors = await this.vendorRepo
      .find({ _id: { $in: vendorIds.map((id) => new Types.ObjectId(id)) } })
      .lean();
    const vendorMap = new Map(
      vendors.map((v) => [v._id.toString(), v.legal_name]),
    );

    const workspace = await this.workspaceRepo
      .findById(this.ctx.workspaceId)
      .lean();
    const categories = workspace?.settings?.enterprise_risk_categories ?? [];
    const useProvisional = categories.length === 0;
    const activeCategories = useProvisional
      ? DEFAULT_ENTERPRISE_RISK_CATEGORIES
      : categories;

    // Batch-resolve internal CAP task owners' display names (Phase 9) — one query for every
    // risk's cap_tasks rather than one per task, since the register can list many risks.
    const internalOwnerIds = [
      ...new Set(
        risks.flatMap((r) =>
          (r.cap_tasks ?? [])
            .filter((t) => t.owner_type === "internal" && t.owner_ref)
            .map((t) => t.owner_ref!.toString()),
        ),
      ),
    ];
    const internalOwners =
      internalOwnerIds.length > 0
        ? await User.find({
            _id: { $in: internalOwnerIds.map((id) => new Types.ObjectId(id)) },
          }).lean()
        : [];
    const internalOwnerMap = new Map(
      internalOwners.map((u) => [u._id.toString(), u.name]),
    );

    return {
      risks: risks.map((r) => ({
        id: r._id.toString(),
        vendor_id: r.vendor_id.toString(),
        vendor_name: vendorMap.get(r.vendor_id.toString()) ?? "Unknown Vendor",
        assessment_id: r.assessment_id.toString(),
        control_id: r.control_id,
        title: r.title,
        description: r.description,
        severity: r.severity,
        enterprise_risk_category: r.enterprise_risk_category,
        impact_level: r.impact_level,
        residual_score: r.residual_score,
        residual_inputs: r.residual_inputs,
        status: r.status,
        cap_tasks_count: r.cap_tasks?.length ?? 0,
        cap_tasks: (r.cap_tasks ?? []).map((t) => ({
          task_id: t.task_id?.toString() ?? "",
          description: t.description,
          owner_type: t.owner_type as CapTaskOwnerType,
          owner_label:
            t.owner_type === "vendor"
              ? (vendorMap.get(r.vendor_id.toString()) ?? "Vendor SPOC")
              : (internalOwnerMap.get(t.owner_ref?.toString() ?? "") ??
                "Unknown user"),
          due_date: new Date(t.due_date).toISOString(),
          status: t.status as CapTaskStatus,
          closed_at: t.closed_at ? new Date(t.closed_at).toISOString() : null,
          escalated_at: t.escalated_at
            ? new Date(t.escalated_at).toISOString()
            : null,
        })),
        created_at:
          (r as unknown as { created_at?: Date }).created_at?.toISOString() ??
          new Date().toISOString(),
      })),
      enterprise_risk_categories: activeCategories,
      is_provisional_taxonomy: useProvisional,
    };
  }
}
