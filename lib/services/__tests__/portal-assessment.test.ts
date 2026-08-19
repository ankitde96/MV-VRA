// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Assessment } from "@/lib/db/models/assessment";
import { Response } from "@/lib/db/models/response";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  deleteEvidence,
  getEvidenceFile,
  saveResponse,
  submitAssessment,
  uploadEvidence,
} from "@/lib/services/portal-assessment";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

const schema: QuestionsSchema = {
  schema_format_version: 1,
  sections: [
    {
      id: "sec_1",
      title: "Section 1",
      questions: [
        { control_id: "Q1", text: "Q1?", type: "text", required: true },
        {
          control_id: "Q2",
          text: 'Q2 (only if Q1 is "trigger")?',
          type: "text",
          required: true,
          show_if: { all: [{ control_id: "Q1", op: "eq", value: "trigger" }] },
        },
        {
          control_id: "Q3",
          text: "Q3 (needs evidence)?",
          type: "text",
          required: false,
          evidence: { required: true, accept: ["pdf"] },
        },
      ],
    },
  ],
};

/**
 * TEST-CHECKLIST.md Gate 2/4/6 — verified against a real database. The suppressed-question
 * test is PLAN.md Phase 7's named exit criterion, not incidental coverage.
 */
describe("portal assessment answering (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const spocId = new Types.ObjectId();
  const otherVendorId = new Types.ObjectId();
  const otherSpocId = new Types.ObjectId();
  const engagementId = new Types.ObjectId();
  const templateId = new Types.ObjectId();

  async function createAssessment(
    status: "sent" | "in_progress" | "submitted" | "draft" = "sent",
  ) {
    return Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorId,
      template_id: templateId,
      template_version: 1,
      template_snapshot: schema,
      status,
      assigned_at: new Date(),
    });
  }

  const session = () => ({
    vendorId: vendorId.toString(),
    workspaceId: workspaceId.toString(),
    spocId: spocId.toString(),
  });
  const otherVendorSession = () => ({
    vendorId: otherVendorId.toString(),
    spocId: otherSpocId.toString(),
    workspaceId: workspaceId.toString(),
  });

  afterEach(async () => {
    await Assessment.deleteMany({ workspace_id: workspaceId });
    await Response.deleteMany({ workspace_id: workspaceId });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await rm(resolve(process.cwd(), ".storage-local"), {
      recursive: true,
      force: true,
    });
  });

  it("saves an answer and upserts idempotently on a second save for the same control", async () => {
    await dbConnect();
    const assessment = await createAssessment();

    await saveResponse(session(), assessment._id.toString(), "Q1", "first");
    await saveResponse(session(), assessment._id.toString(), "Q1", "second");

    const stored = await Response.find({
      assessment_id: assessment._id,
      control_id: "Q1",
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].response_value).toBe("second");
  });

  it("rejects saving an answer for an unknown control_id", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await expect(
      saveResponse(session(), assessment._id.toString(), "GHOST", "x"),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses access to another vendor's assessment (cross-vendor tampering)", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await expect(
      saveResponse(otherVendorSession(), assessment._id.toString(), "Q1", "x"),
    ).rejects.toThrow(NotFoundError);
  });

  it("uploads evidence, creating a response shell without fabricating an answer", async () => {
    await dbConnect();
    const assessment = await createAssessment();

    const evidence = await uploadEvidence(
      session(),
      assessment._id.toString(),
      "Q3",
      {
        filename: "proof.pdf",
        mime: "application/pdf",
        body: Buffer.from("pdf bytes"),
      },
    );
    expect(evidence.filename).toBe("proof.pdf");

    const stored = await Response.findOne({
      assessment_id: assessment._id,
      control_id: "Q3",
    });
    expect(stored?.response_value).toBeNull();
    expect(stored?.evidence).toHaveLength(1);
  });

  it("rejects an evidence upload with a disallowed MIME type", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await expect(
      uploadEvidence(session(), assessment._id.toString(), "Q3", {
        filename: "malware.exe",
        mime: "application/x-msdownload",
        body: Buffer.from("x"),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an evidence upload whose extension is not in the accept list", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await expect(
      uploadEvidence(session(), assessment._id.toString(), "Q3", {
        filename: "proof.png",
        mime: "image/png",
        body: Buffer.from("x"),
      }),
    ).rejects.toThrow(/Accepted file types/);
  });

  it("accepts an optional evidence upload on a question with no evidence config (ASSESSMENT-WORKFLOW-PLAN.md Stage 1, D4)", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    const evidence = await uploadEvidence(
      session(),
      assessment._id.toString(),
      "Q1",
      {
        filename: "proof.pdf",
        mime: "application/pdf",
        body: Buffer.from("x"),
      },
    );
    expect(evidence.filename).toBe("proof.pdf");
  });

  it("still rejects a disallowed MIME type on a question with no evidence config", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await expect(
      uploadEvidence(session(), assessment._id.toString(), "Q1", {
        filename: "malware.exe",
        mime: "application/x-msdownload",
        body: Buffer.from("x"),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("deletes an evidence file, removing both the record and the stored bytes", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    const evidence = await uploadEvidence(
      session(),
      assessment._id.toString(),
      "Q3",
      {
        filename: "proof.pdf",
        mime: "application/pdf",
        body: Buffer.from("pdf bytes"),
      },
    );

    await deleteEvidence(
      session(),
      assessment._id.toString(),
      "Q3",
      evidence._id.toString(),
    );

    const stored = await Response.findOne({
      assessment_id: assessment._id,
      control_id: "Q3",
    });
    expect(stored?.evidence).toHaveLength(0);

    await expect(
      getEvidenceFile(
        session(),
        assessment._id.toString(),
        "Q3",
        evidence._id.toString(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses to delete evidence on a submitted assessment", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    const evidence = await uploadEvidence(
      session(),
      assessment._id.toString(),
      "Q3",
      {
        filename: "proof.pdf",
        mime: "application/pdf",
        body: Buffer.from("pdf bytes"),
      },
    );
    await Assessment.updateOne(
      { _id: assessment._id },
      { $set: { status: "submitted" } },
    );

    await expect(
      deleteEvidence(
        session(),
        assessment._id.toString(),
        "Q3",
        evidence._id.toString(),
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("retrieves an uploaded evidence file byte-identically, refusing a wrong evidence id", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    const body = Buffer.from("pdf bytes");
    const evidence = await uploadEvidence(
      session(),
      assessment._id.toString(),
      "Q3",
      {
        filename: "proof.pdf",
        mime: "application/pdf",
        body,
      },
    );

    const retrieved = await getEvidenceFile(
      session(),
      assessment._id.toString(),
      "Q3",
      evidence._id.toString(),
    );
    expect(retrieved.body.equals(body)).toBe(true);

    await expect(
      getEvidenceFile(
        session(),
        assessment._id.toString(),
        "Q3",
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("blocks submission when a visible required question is unanswered", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    // Q1 unanswered, Q2 suppressed (Q1 != 'trigger' since Q1 has no answer at all).
    await expect(
      submitAssessment(session(), assessment._id.toString()),
    ).rejects.toThrow(/Q1/);
  });

  it("blocks submission when required evidence is missing", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await saveResponse(session(), assessment._id.toString(), "Q1", "anything");
    await expect(
      submitAssessment(session(), assessment._id.toString()),
    ).rejects.toThrow(/Q3/);
  });

  it("a suppressed required question does NOT block submission (PLAN.md Phase 7 exit criterion)", async () => {
    await dbConnect();
    const assessment = await createAssessment();

    // Q1 answered with something other than "trigger" -> Q2 (required) is suppressed.
    await saveResponse(
      session(),
      assessment._id.toString(),
      "Q1",
      "not-the-trigger-value",
    );
    await uploadEvidence(session(), assessment._id.toString(), "Q3", {
      filename: "proof.pdf",
      mime: "application/pdf",
      body: Buffer.from("pdf bytes"),
    });
    // Q2 deliberately left unanswered — it must not appear in the missing list.

    const submitted = await submitAssessment(
      session(),
      assessment._id.toString(),
    );
    expect(submitted.status).toBe("submitted");

    const stored = await Assessment.findById(assessment._id);
    expect(stored?.status).toBe("submitted");
    expect(stored?.submitted_at).not.toBeNull();
  });

  it("submits successfully when every visible required question and required evidence is satisfied", async () => {
    await dbConnect();
    const assessment = await createAssessment();
    await saveResponse(session(), assessment._id.toString(), "Q1", "trigger");
    await saveResponse(session(), assessment._id.toString(), "Q2", "answered");
    await uploadEvidence(session(), assessment._id.toString(), "Q3", {
      filename: "proof.pdf",
      mime: "application/pdf",
      body: Buffer.from("pdf bytes"),
    });

    const submitted = await submitAssessment(
      session(),
      assessment._id.toString(),
    );
    expect(submitted.status).toBe("submitted");
  });

  it("refuses to edit (answer or upload) a submitted assessment", async () => {
    await dbConnect();
    const assessment = await createAssessment("submitted");

    await expect(
      saveResponse(session(), assessment._id.toString(), "Q1", "x"),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      uploadEvidence(session(), assessment._id.toString(), "Q3", {
        filename: "proof.pdf",
        mime: "application/pdf",
        body: Buffer.from("x"),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses to submit an assessment a second time", async () => {
    await dbConnect();
    const assessment = await createAssessment("submitted");
    await expect(
      submitAssessment(session(), assessment._id.toString()),
    ).rejects.toThrow(ForbiddenError);
  });
});
