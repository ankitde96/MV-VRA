import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { Assessment } from "@/lib/db/models/assessment";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { Engagement } from "@/lib/db/models/engagement";
import { Response } from "@/lib/db/models/response";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Workspace } from "@/lib/db/models/workspace";
import { dbConnect } from "@/lib/db/connect";
import { createSessionToken } from "@/lib/auth/session";
import { INTERNAL_SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { createPortalSessionToken } from "@/lib/auth/portal-session";
import { PORTAL_SESSION_COOKIE } from "@/lib/auth/portal-session-cookie";
import { LocalFsStorageDriver } from "@/lib/storage/local-fs";

test.describe("reviewer evidence", () => {
  test.setTimeout(60_000);
  let assessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  let responseId: mongoose.Types.ObjectId;
  let evidenceId: mongoose.Types.ObjectId;
  let workspaceId: mongoose.Types.ObjectId;
  let adminId: mongoose.Types.ObjectId;
  let vendorId: mongoose.Types.ObjectId;
  let spocId: mongoose.Types.ObjectId;
  const controlId = "EVIDENCE-01";
  const storageKey = `e2e/reviewer-evidence-${Date.now()}.txt`;
  const evidenceBody = Buffer.from("reviewer evidence fixture");
  const storage = new LocalFsStorageDriver();
  const label = `Reviewer evidence ${Date.now()}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findOne({ domain: "apex-cloud.demo.mv-vra.local" }).lean(),
    ]);
    if (!workspace || !admin || !vendor || vendor.spocs.length === 0) {
      throw new Error(
        "Reviewer-evidence E2E requires the documented seed fixtures",
      );
    }
    workspaceId = workspace._id;
    adminId = admin._id;
    vendorId = vendor._id;
    const recipient =
      vendor.spocs.find((spoc) => spoc.is_primary) ?? vendor.spocs[0]!;
    spocId = recipient._id;
    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: label,
      functional_scope: "Disposable reviewer-evidence fixture",
      expected_procurement_date: new Date("2030-01-01"),
      data_classification: ["none"],
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
            id: "evidence",
            title: "Evidence controls",
            questions: [
              {
                control_id: controlId,
                text: "Provide the current control policy",
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
    await storage.put(storageKey, evidenceBody);
    const response = await Response.create({
      workspace_id: workspace._id,
      assessment_id: assessment._id,
      control_id: controlId,
      question_text: "Provide the current control policy",
      response_value: "Attached",
      evidence: [
        {
          file_key: storageKey,
          filename: "control-policy.txt",
          mime: "text/plain",
          size: evidenceBody.byteLength,
          uploaded_at: new Date("2026-08-20T01:02:03.000Z"),
          uploaded_by: recipient._id,
        },
      ],
    });
    responseId = response._id;
    evidenceId = response.evidence[0]!._id!;
  });

  test.afterAll(async () => {
    if (assessmentId) {
      await Promise.all([
        Response.deleteMany({
          workspace_id: workspaceId,
          assessment_id: assessmentId,
        }),
        AuditEvent.deleteMany({
          workspace_id: workspaceId,
          entity_id: responseId,
        }),
        Assessment.deleteOne({
          workspace_id: workspaceId,
          _id: assessmentId,
        }),
      ]);
    }
    if (engagementId) {
      await Engagement.deleteOne({
        workspace_id: workspaceId,
        _id: engagementId,
      });
    }
    await storage.delete(storageKey);
  });

  test("downloads, annotates, filters, exports, and preserves session isolation", async ({
    page,
  }) => {
    const internalToken = await createSessionToken({
      userId: adminId.toString(),
      workspaceId: workspaceId.toString(),
    });
    await page.context().addCookies([
      {
        name: INTERNAL_SESSION_COOKIE,
        value: internalToken,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`/assessments/${assessmentId}`);

    const evidenceCard = page.locator(
      `[data-review-evidence="${evidenceId.toString()}"]`,
    );
    await expect(evidenceCard).toContainText("control-policy.txt");
    await expect(evidenceCard).toContainText("Text");
    await expect(evidenceCard).toContainText("Uploaded");
    await expect(evidenceCard).toContainText("by");

    const internalUrl = `/api/assessments/${assessmentId}/responses/${controlId}/evidence/${evidenceId}`;
    const portalUrl = `/api/portal/assessments/${assessmentId}/responses/${controlId}/evidence/${evidenceId}`;
    const [internalDownload] = await Promise.all([
      page.waitForEvent("download"),
      evidenceCard.getByRole("button", { name: "Download" }).click(),
    ]);
    expect(internalDownload.suggestedFilename()).toBe("control-policy.txt");
    expect(
      await page.evaluate(async (url) => (await fetch(url)).status, portalUrl),
    ).toBe(401);

    await evidenceCard
      .getByRole("button", { name: "Mark insufficient" })
      .click();
    await page
      .getByLabel("Reviewer note (optional)")
      .fill("Approval page is missing");
    const flagSaved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/evidence/${evidenceId}/flag`) &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save flag" }).click();
    expect((await flagSaved).status()).toBe(200);
    await expect(evidenceCard.getByText("Insufficient")).toBeVisible();
    await expect(evidenceCard).toContainText("Approval page is missing");

    await page.getByRole("button", { name: /^Missing evidence 1$/ }).click();
    await expect(
      page.locator(`[data-review-control="${controlId}"]`),
    ).toBeVisible();

    const [archiveDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download evidence ZIP" }).click(),
    ]);
    expect(archiveDownload.suggestedFilename()).toMatch(/-evidence\.zip$/);

    await page.context().clearCookies();
    const portalToken = await createPortalSessionToken({
      workspaceId: workspaceId.toString(),
      vendorId: vendorId.toString(),
      spocId: spocId.toString(),
    });
    await page.context().addCookies([
      {
        name: PORTAL_SESSION_COOKIE,
        value: portalToken,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/portal");
    expect(
      await page.evaluate(
        async (url) => (await fetch(url)).status,
        internalUrl,
      ),
    ).toBe(401);
    expect(
      await page.evaluate(async (url) => (await fetch(url)).status, portalUrl),
    ).toBe(200);
  });
});
