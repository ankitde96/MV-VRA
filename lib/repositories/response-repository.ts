import { type Types, type QueryFilter, type UpdateQuery } from "mongoose";
import { Response, type ResponseDoc } from "@/lib/db/models/response";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export type EvidenceInput = {
  _id: Types.ObjectId;
  file_key: string;
  filename: string;
  mime: string;
  size: number;
  uploaded_by: Types.ObjectId;
  uploaded_at: Date;
};

/**
 * PLAN.md Phase 7. `upsertAnswer`/`ensureShell`/`addEvidence` all route through
 * `{ workspace_id, assessment_id, control_id }` upserts — the unique index on that triple
 * (DATA-MODEL.md §2) is what makes autosave idempotent: retrying an autosave after a
 * network blip never creates a duplicate response document.
 */
export class ResponseRepository extends TenantRepository<ResponseDoc> {
  constructor(ctx: TenantContext) {
    super(Response, ctx);
  }

  findByAssessment(assessmentId: string | Types.ObjectId) {
    return this.find({
      assessment_id: toObjectId(assessmentId),
    } as QueryFilter<ResponseDoc>);
  }

  findOneByControl(assessmentId: string | Types.ObjectId, controlId: string) {
    return this.findOne({
      assessment_id: toObjectId(assessmentId),
      control_id: controlId,
    } as QueryFilter<ResponseDoc>);
  }

  upsertAnswer(
    assessmentId: string | Types.ObjectId,
    controlId: string,
    update: {
      question_text: string;
      response_value: unknown;
      answered_by: Types.ObjectId;
    },
  ) {
    return this.model.findOneAndUpdate(
      this.scope({
        assessment_id: toObjectId(assessmentId),
        control_id: controlId,
      } as QueryFilter<ResponseDoc>),
      {
        $set: {
          question_text: update.question_text,
          response_value: update.response_value,
          answered_by: update.answered_by,
          answered_at: new Date(),
        },
      } as UpdateQuery<ResponseDoc>,
      { upsert: true, returnDocument: "after" },
    );
  }

  /**
   * Ensures a response document exists for this control before a file is written to
   * storage — DATA-MODEL.md §5's evidence-upload ordering ("write the response record
   * first, then the file... fail toward the orphan"). Does not touch `response_value` —
   * uploading evidence for a control the SPOC hasn't typed an answer for yet must not
   * fabricate one.
   */
  ensureShell(
    assessmentId: string | Types.ObjectId,
    controlId: string,
    questionText: string,
  ) {
    return this.model.findOneAndUpdate(
      this.scope({
        assessment_id: toObjectId(assessmentId),
        control_id: controlId,
      } as QueryFilter<ResponseDoc>),
      {
        $setOnInsert: { question_text: questionText },
      } as UpdateQuery<ResponseDoc>,
      { upsert: true, returnDocument: "after" },
    );
  }

  addEvidence(
    assessmentId: string | Types.ObjectId,
    controlId: string,
    evidence: EvidenceInput,
  ) {
    return this.updateOne(
      {
        assessment_id: toObjectId(assessmentId),
        control_id: controlId,
      } as QueryFilter<ResponseDoc>,
      { $push: { evidence } } as UpdateQuery<ResponseDoc>,
    );
  }

  /** ASSESSMENT-WORKFLOW-PLAN.md Stage 1 — removes one evidence subdocument by its own
   * `_id`, scoped by the same triple as every other write on this collection. */
  pullEvidence(
    assessmentId: string | Types.ObjectId,
    controlId: string,
    evidenceId: string | Types.ObjectId,
  ) {
    return this.updateOne(
      {
        assessment_id: toObjectId(assessmentId),
        control_id: controlId,
      } as QueryFilter<ResponseDoc>,
      {
        $pull: { evidence: { _id: toObjectId(evidenceId) } },
      } as UpdateQuery<ResponseDoc>,
    );
  }

  /**
   * Reviewer Experience Stage 4 — atomically replaces this evidence item's advisory flag.
   * The response and evidence id remain workspace/control scoped; the aggregation pipeline
   * avoids a pull-then-push window and guarantees at most one flag per evidence item.
   */
  setEvidenceFlag(
    assessmentId: string | Types.ObjectId,
    controlId: string,
    evidenceId: string | Types.ObjectId,
    flag: {
      evidence_id: Types.ObjectId;
      flag: "insufficient";
      note: string;
      flagged_at: Date;
      flagged_by: Types.ObjectId;
    } | null,
  ) {
    const evidenceObjectId = toObjectId(evidenceId);
    return this.model.findOneAndUpdate(
      this.scope({
        assessment_id: toObjectId(assessmentId),
        control_id: controlId,
        "evidence._id": evidenceObjectId,
      } as QueryFilter<ResponseDoc>),
      [
        {
          $set: {
            evidence_flags: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ["$evidence_flags", []] },
                    as: "existing",
                    cond: {
                      $ne: ["$$existing.evidence_id", evidenceObjectId],
                    },
                  },
                },
                flag ? [flag] : [],
              ],
            },
          },
        },
      ],
      { updatePipeline: true, returnDocument: "after" },
    );
  }

  markReview(
    assessmentId: string | Types.ObjectId,
    controlId: string,
    input: {
      review_status: "compliant" | "non_compliant";
      reviewer_note: string;
      reviewed_by: Types.ObjectId;
      review_round: number;
    },
  ) {
    return this.model.findOneAndUpdate(
      this.scope({
        assessment_id: toObjectId(assessmentId),
        control_id: controlId,
      } as QueryFilter<ResponseDoc>),
      {
        $set: { ...input, reviewed_at: new Date() },
      } as UpdateQuery<ResponseDoc>,
      { returnDocument: "after" },
    );
  }
}
