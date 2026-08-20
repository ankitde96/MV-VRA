import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { Assessment } from "@/lib/db/models/assessment";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { Engagement } from "@/lib/db/models/engagement";
import { Response } from "@/lib/db/models/response";
import { Risk } from "@/lib/db/models/risk";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Workspace } from "@/lib/db/models/workspace";
import { dbConnect } from "@/lib/db/connect";
import { createSessionToken } from "@/lib/auth/session";
import { INTERNAL_SESSION_COOKIE } from "@/lib/auth/session-cookie";

test.describe("reviewer risk and remediation", () => {
  test.setTimeout(60_000);
  let assessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  let workspaceId: mongoose.Types.ObjectId;
  let adminId: mongoose.Types.ObjectId;
  let vendorId: mongoose.Types.ObjectId;
  let responseIds: mongoose.Types.ObjectId[] = [];
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const label = `Reviewer remediation ${runId}`;
  const overdueDescription = `Overdue remediation ${runId}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findOne({ domain: "apex-cloud.demo.mv-vra.local" }).lean(),
    ]);
    if (!workspace || !admin || !vendor || vendor.spocs.length === 0) {
      throw new Error(
        "Reviewer-remediation E2E requires the documented seed fixtures",
      );
    }
    workspaceId = workspace._id;
    adminId = admin._id;
    vendorId = vendor._id;
    const recipient =
      vendor.spocs.find((spoc) => spoc.is_primary) ?? vendor.spocs[0]!;
    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: label,
      functional_scope: "Disposable reviewer-remediation fixture",
      expected_procurement_date: new Date("2030-01-01"),
      data_classification: ["none"],
      inherent_score: { total: 60, breakdown: {}, weights_version: 1 },
      inherent_risk_tier: 2,
      status: "in_assessment",
    });
    engagementId = engagement._id;
    const assessment = await Assessment.create({
      workspace_id: workspace._id,
      engagement_id: engagement._id,
      vendor_id: vendor._id,
      template_id: new mongoose.Types.ObjectId(),
      template_version: 1,
      template_name: label,
      template_snapshot: {
        schema_format_version: 1,
        sections: [
          {
            id: "remediation",
            title: "Remediation controls",
            questions: [
              {
                control_id: "REMED-01",
                text: "Privileged access reviews are current",
                type: "text",
                required: true,
              },
              {
                control_id: "REMED-02",
                text: "Incident remediation is tracked",
                type: "text",
                required: true,
              },
            ],
          },
        ],
      },
      status: "submitted",
      recipients: [recipient._id],
      assigned_at: new Date(),
      sent_at: new Date(),
      submitted_at: new Date(),
      last_activity_at: new Date(),
    });
    assessmentId = assessment._id;
    const responses = await Response.create([
      {
        workspace_id: workspace._id,
        assessment_id: assessment._id,
        control_id: "REMED-01",
        question_text: "Privileged access reviews are current",
        response_value: "No",
      },
      {
        workspace_id: workspace._id,
        assessment_id: assessment._id,
        control_id: "REMED-02",
        question_text: "Incident remediation is tracked",
        response_value: "Yes",
        review_status: "compliant",
        reviewer_note: "Verified",
        reviewed_by: admin._id,
      },
    ]);
    responseIds = responses.map((response) => response._id);

    const incompleteTaskId = new mongoose.Types.ObjectId();
    await Risk.create({
      workspace_id: workspace._id,
      assessment_id: assessment._id,
      engagement_id: engagement._id,
      vendor_id: vendor._id,
      control_id: "REMED-02",
      title: `Existing remediation ${runId}`,
      description: "Existing risk with legacy and overdue corrective actions",
      severity: "medium",
      enterprise_risk_category: "Information Security",
      impact_level: "medium",
      residual_score: 20,
      residual_inputs: {},
      status: "open",
      cap_tasks: [
        {
          task_id: incompleteTaskId,
          description: "Legacy task missing completion details",
          owner_type: "vendor",
          owner_ref: vendor._id,
          due_date: new Date("2099-01-01"),
          status: "open",
        },
        {
          task_id: new mongoose.Types.ObjectId(),
          description: overdueDescription,
          owner_type: "vendor",
          owner_ref: vendor._id,
          due_date: new Date("2020-01-01"),
          status: "open",
        },
      ],
    });
    await Risk.collection.updateOne(
      { assessment_id: assessment._id, "cap_tasks.task_id": incompleteTaskId },
      {
        $unset: {
          "cap_tasks.0.owner_ref": true,
          "cap_tasks.0.due_date": true,
        },
      },
    );
  });

  test.afterAll(async () => {
    if (!assessmentId) return;
    const risks = await Risk.find({
      workspace_id: workspaceId,
      assessment_id: assessmentId,
    })
      .select({ _id: 1 })
      .lean();
    await Promise.all([
      AuditEvent.deleteMany({
        workspace_id: workspaceId,
        entity_id: {
          $in: [assessmentId, ...responseIds, ...risks.map((risk) => risk._id)],
        },
      }),
      Risk.deleteMany({
        workspace_id: workspaceId,
        assessment_id: assessmentId,
      }),
      Response.deleteMany({
        workspace_id: workspaceId,
        assessment_id: assessmentId,
      }),
      Assessment.deleteOne({ workspace_id: workspaceId, _id: assessmentId }),
      Engagement.deleteOne({ workspace_id: workspaceId, _id: engagementId }),
    ]);
  });

  test("raises a required risk, audits the CAP override, and shows vendor overdue work", async ({
    page,
  }) => {
    const token = await createSessionToken({
      userId: adminId.toString(),
      workspaceId: workspaceId.toString(),
    });
    await page.context().addCookies([
      {
        name: INTERNAL_SESSION_COOKIE,
        value: token,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto(`/vendors/${vendorId}`);
    const overdueItem = page
      .locator("[data-overdue-cap]")
      .filter({ hasText: overdueDescription });
    await expect(overdueItem).toBeVisible();
    await overdueItem.getByRole("link", { name: "Open risk" }).click();
    await expect(page).toHaveURL(/\/risks#risk-/);
    const riskAnchor = new URL(page.url()).hash.slice(1);
    await expect(page.locator(`[id="${riskAnchor}"]`)).toBeVisible();

    await page.goto(`/assessments/${assessmentId}`);
    const control = page.locator('[data-review-control="REMED-01"]');
    const verdictSaved = page.waitForResponse(
      (response) =>
        response.url().includes("/responses/REMED-01/review") &&
        response.request().method() === "PATCH",
    );
    await control.getByRole("button", { name: "Non-compliant" }).click();
    expect((await verdictSaved).status()).toBe(200);
    await expect(
      control.getByText("Risk required", { exact: true }),
    ).toBeVisible();

    await control.getByRole("button", { name: "Raise required risk" }).click();
    await expect(page.getByLabel("Risk Title *")).toHaveValue(
      /REMED-01: Privileged access reviews are current/,
    );
    await expect(page.getByLabel("Risk Description")).toHaveValue(
      /marked non-compliant/,
    );
    const riskCreated = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/assessments/${assessmentId}/risks`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Raise Identified Risk" }).click();
    expect((await riskCreated).status()).toBe(201);
    await expect(
      control.getByText("1 risk linked", { exact: true }),
    ).toBeVisible();

    const csvLink = page.getByRole("button", { name: "CSV report" });
    const pdfLink = page.getByRole("button", { name: "PDF report" });
    const csvResponse = await page.request.get(
      (await csvLink.getAttribute("href"))!,
    );
    expect(csvResponse.status()).toBe(200);
    expect(csvResponse.headers()["content-type"]).toContain("text/csv");
    expect((await csvResponse.body()).subarray(0, 3)).toEqual(
      Buffer.from([0xef, 0xbb, 0xbf]),
    );
    const pdfResponse = await page.request.get(
      (await pdfLink.getAttribute("href"))!,
    );
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
    expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const completeButton = page.getByRole("button", {
      name: "Complete Review",
    });
    await expect(completeButton).toBeEnabled();
    await completeButton.click();
    const completionDialog = page.getByRole("dialog", {
      name: "Complete assessment review",
    });
    await expect(completionDialog).toContainText("2/2");
    await expect(completionDialog).toContainText(
      "Incomplete corrective action details",
    );
    const confirmButton = completionDialog.getByRole("button", {
      name: "Confirm completion",
    });
    await expect(confirmButton).toBeDisabled();
    await completionDialog.getByRole("checkbox").click();
    await expect(confirmButton).toBeEnabled();
    const completed = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/assessments/${assessmentId}/complete-review`) &&
        response.request().method() === "POST",
    );
    await confirmButton.click();
    expect((await completed).status()).toBe(200);
    await expect(
      page.getByRole("button", { name: "Review Completed" }),
    ).toBeVisible();

    const overrideEvent = await AuditEvent.findOne({
      workspace_id: workspaceId,
      entity_id: assessmentId,
      action: "assessment.cap_completeness_overridden",
    }).lean();
    expect(overrideEvent?.actor.id?.toString()).toBe(adminId.toString());
  });
});
