import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { ResponseRepository } from "@/lib/repositories/response-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getStorageDriver } from "@/lib/storage";
import {
  sanitizeFilename,
  validateUploadedFile,
} from "@/lib/uploads/constraints";
import {
  computeVisibility,
  findQuestion,
  isAnswered,
  type AnswersMap,
} from "@/lib/questionnaire/evaluator";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import type { PortalSessionPayload } from "@/lib/auth/portal-session";

/**
 * PLAN.md Phase 7 / `FLOW.md` F3 steps 3-8. Every function here takes the portal session,
 * not a bare workspace/vendor id — `FLOW.md` F2 gap (b) says vendor scope is re-derived
 * from the session on every request, and this is where that discipline actually gets
 * enforced for the assessment-answering surface, not just the OTP surface Phase 6 covered.
 */
// Shared by submission and by every write (answer/evidence) — once an assessment leaves
// these statuses, the portal must refuse to mutate it, not just hide the inputs in the UI.
// The client-side `readOnly` flag (components/portal/assessment-answer-form.tsx) is a UX
// nicety; this is the actual boundary.
const EDITABLE_STATUSES = new Set(["sent", "in_progress"]);

export async function listVendorAssessments(session: PortalSessionPayload) {
  await dbConnect();
  const assessmentRepo = new AssessmentRepository({
    workspaceId: session.workspaceId,
  });
  return assessmentRepo
    .find({ vendor_id: session.vendorId, status: { $ne: "draft" } })
    .sort({ assigned_at: -1 })
    .lean();
}

async function getVendorAssessment(
  session: PortalSessionPayload,
  assessmentId: string,
) {
  await dbConnect();
  const assessmentRepo = new AssessmentRepository({
    workspaceId: session.workspaceId,
  });
  const assessment = await assessmentRepo.findById(assessmentId);
  // Not found and "belongs to a different vendor" return the identical error — a vendor
  // probing assessment ids can't distinguish "doesn't exist" from "not yours."
  if (
    !assessment ||
    assessment.status === "draft" ||
    assessment.vendor_id.toString() !== session.vendorId
  ) {
    throw new NotFoundError(`Assessment ${assessmentId} not found`);
  }
  return assessment;
}

async function getEditableVendorAssessment(
  session: PortalSessionPayload,
  assessmentId: string,
) {
  const assessment = await getVendorAssessment(session, assessmentId);
  if (!EDITABLE_STATUSES.has(assessment.status)) {
    throw new ForbiddenError(
      `Assessment ${assessmentId} is ${assessment.status} and can no longer be edited`,
    );
  }
  return assessment;
}

export async function getAssessmentForAnswering(
  session: PortalSessionPayload,
  assessmentId: string,
) {
  const assessment = await getVendorAssessment(session, assessmentId);
  const responseRepo = new ResponseRepository({
    workspaceId: session.workspaceId,
  });
  const responses = await responseRepo.findByAssessment(assessmentId).lean();
  return { assessment, responses };
}

export async function saveResponse(
  session: PortalSessionPayload,
  assessmentId: string,
  controlId: string,
  value: unknown,
) {
  const assessment = await getEditableVendorAssessment(session, assessmentId);
  const schema = assessment.template_snapshot as unknown as QuestionsSchema;
  const question = findQuestion(schema, controlId);
  if (!question) {
    throw new ValidationError(
      `Unknown control_id "${controlId}" for this assessment`,
    );
  }

  const responseRepo = new ResponseRepository({
    workspaceId: session.workspaceId,
  });
  return responseRepo.upsertAnswer(assessmentId, controlId, {
    question_text: question.text,
    response_value: value,
    answered_by: new Types.ObjectId(session.vendorId),
  });
}

export interface UploadEvidenceInput {
  filename: string;
  mime: string;
  body: Buffer;
}

/**
 * DATA-MODEL.md §5's ordering: the response "record" (a shell, if one doesn't already
 * exist) is written first, the file second, and the evidence metadata (the key) patched
 * onto the record last. If the storage write fails, the shell is harmless — an
 * unanswered-so-far response, not a broken reference. If the metadata patch fails after a
 * successful storage write, the result is an orphaned file
 * (`scripts/sweep-orphaned-evidence.ts` finds these), never a record pointing at nothing —
 * "fail toward the orphan."
 */
export async function uploadEvidence(
  session: PortalSessionPayload,
  assessmentId: string,
  controlId: string,
  input: UploadEvidenceInput,
) {
  const assessment = await getEditableVendorAssessment(session, assessmentId);
  const schema = assessment.template_snapshot as unknown as QuestionsSchema;
  const question = findQuestion(schema, controlId);
  if (!question) {
    throw new ValidationError(
      `Unknown control_id "${controlId}" for this assessment`,
    );
  }
  // ASSESSMENT-WORKFLOW-PLAN.md Stage 1 (D4): evidence upload is accepted on every
  // question now, not only ones the template flags with an `evidence` object — the real
  // seeded questionnaire never sets one. `validateUploadedFile()` below (MIME + size) is
  // the sole file-type authority for a question with no `evidence` config; the accept-list
  // check remains scoped to when the template author actually set one.

  validateUploadedFile({ mime: input.mime, size: input.body.byteLength });

  const accept = question.evidence?.accept;
  if (accept?.length) {
    const extension = input.filename.split(".").pop()?.toLowerCase();
    if (!extension || !accept.map((a) => a.toLowerCase()).includes(extension)) {
      throw new ValidationError(
        `Accepted file types for "${controlId}": ${accept.join(", ")}`,
      );
    }
  }

  const responseRepo = new ResponseRepository({
    workspaceId: session.workspaceId,
  });
  await responseRepo.ensureShell(assessmentId, controlId, question.text);

  const key = `${session.workspaceId}/assessments/${assessmentId}/${controlId}/${randomUUID()}-${sanitizeFilename(input.filename)}`;
  const storage = getStorageDriver();
  const stored = await storage.put(key, input.body);

  const evidence = {
    _id: new Types.ObjectId(),
    file_key: key,
    filename: input.filename,
    mime: input.mime,
    size: stored.size,
    uploaded_by: new Types.ObjectId(session.vendorId),
    uploaded_at: new Date(),
  };
  await responseRepo.addEvidence(assessmentId, controlId, evidence);

  await recordAuditEvent({
    workspace_id: assessment.workspace_id,
    actor: {
      type: "vendor",
      id: new Types.ObjectId(session.vendorId),
      email: null,
    },
    action: "response.evidence_uploaded",
    entity_type: "response",
    entity_id: assessment._id,
    diff: {
      control_id: controlId,
      filename: input.filename,
      mime: input.mime,
      size: stored.size,
    },
  });

  return evidence;
}

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 1 — no delete route existed before this; a vendor
 * could upload but never remove a mistaken attachment. Deletes the record before the file
 * (same fail-toward-orphan ordering as upload, DATA-MODEL.md §5, reversed): if the storage
 * delete fails after the record is gone, `scripts/sweep-orphaned-evidence.ts` finds the
 * leftover file — the safer failure mode than a record pointing at nothing.
 */
export async function deleteEvidence(
  session: PortalSessionPayload,
  assessmentId: string,
  controlId: string,
  evidenceId: string,
) {
  const assessment = await getEditableVendorAssessment(session, assessmentId);
  const responseRepo = new ResponseRepository({
    workspaceId: session.workspaceId,
  });
  const response = await responseRepo.findOneByControl(assessmentId, controlId);
  const evidence = response?.evidence.find(
    (e) => e._id?.toString() === evidenceId,
  );
  if (!evidence) {
    throw new NotFoundError(`Evidence ${evidenceId} not found`);
  }

  await responseRepo.pullEvidence(assessmentId, controlId, evidenceId);

  const storage = getStorageDriver();
  await storage.delete(evidence.file_key);

  await recordAuditEvent({
    workspace_id: assessment.workspace_id,
    actor: {
      type: "vendor",
      id: new Types.ObjectId(session.vendorId),
      email: null,
    },
    action: "response.evidence_deleted",
    entity_type: "response",
    entity_id: assessment._id,
    diff: { control_id: controlId, filename: evidence.filename },
  });

  return { ok: true as const };
}

export async function getEvidenceFile(
  session: PortalSessionPayload,
  assessmentId: string,
  controlId: string,
  evidenceId: string,
) {
  await getVendorAssessment(session, assessmentId);

  const responseRepo = new ResponseRepository({
    workspaceId: session.workspaceId,
  });
  const response = await responseRepo.findOneByControl(assessmentId, controlId);
  const evidence = response?.evidence.find(
    (e) => e._id?.toString() === evidenceId,
  );
  if (!evidence) {
    throw new NotFoundError(`Evidence ${evidenceId} not found`);
  }

  const storage = getStorageDriver();
  const body = await storage.get(evidence.file_key);
  return { evidence, body };
}

/**
 * PLAN.md Phase 7 item 5 / exit criterion: a suppressed question is skipped entirely, even
 * if `required: true` — `computeVisibility()` (Phase 5) is the single source of truth for
 * "hidden," reused here exactly as it's used for rendering, so submission validation can
 * never disagree with what the SPOC actually saw on screen.
 */
export async function submitAssessment(
  session: PortalSessionPayload,
  assessmentId: string,
) {
  const assessment = await getEditableVendorAssessment(session, assessmentId);
  const schema = assessment.template_snapshot as unknown as QuestionsSchema;
  const responseRepo = new ResponseRepository({
    workspaceId: session.workspaceId,
  });
  const responses = await responseRepo.findByAssessment(assessmentId).lean();
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));

  const answers: AnswersMap = {};
  for (const response of responses) {
    answers[response.control_id] =
      response.response_value as AnswersMap[string];
  }
  const visibility = computeVisibility(schema, answers);

  const missing: string[] = [];
  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (!visibility.get(question.control_id)) continue; // suppressed — never validated

      const response = responseByControl.get(question.control_id);
      if (
        question.required &&
        !isAnswered(response?.response_value as AnswersMap[string])
      ) {
        missing.push(`${question.control_id} (unanswered)`);
      }
      if (question.evidence?.required && !response?.evidence.length) {
        missing.push(`${question.control_id} (missing required evidence)`);
      }
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(`Cannot submit — missing: ${missing.join(", ")}`);
  }

  const assessmentRepo = new AssessmentRepository({
    workspaceId: session.workspaceId,
  });
  await assessmentRepo.updateOne(
    { _id: assessment._id },
    { $set: { status: "submitted", submitted_at: new Date() } },
  );

  await recordAuditEvent({
    workspace_id: assessment.workspace_id,
    actor: {
      type: "vendor",
      id: new Types.ObjectId(session.vendorId),
      email: null,
    },
    action: "assessment.submitted",
    entity_type: "assessment",
    entity_id: assessment._id,
  });

  return { ...assessment.toObject(), status: "submitted" as const };
}
