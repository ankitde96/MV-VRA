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
import { DEV_VENDOR_ID } from "@/lib/auth/dev-vendor-credentials";
import { createPortalSessionToken } from "@/lib/auth/portal-session";
import { PORTAL_SESSION_COOKIE } from "@/lib/auth/portal-session-cookie";
import { signInInternal } from "./helpers";

test.describe("assessment correction round", () => {
  let assessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  let workspaceId: mongoose.Types.ObjectId;
  let recipientId: mongoose.Types.ObjectId;
  const label = `Correction round ${Date.now()}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findById(DEV_VENDOR_ID).lean(),
    ]);
    if (!workspace || !admin || !vendor || vendor.spocs.length === 0) {
      throw new Error(
        "Correction-round E2E requires the documented seed fixtures",
      );
    }
    workspaceId = workspace._id;
    const recipient =
      vendor.spocs.find((spoc) => spoc.is_primary) ?? vendor.spocs[0]!;
    recipientId = recipient._id;
    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: label,
      functional_scope: "Disposable correction-round fixture",
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
        sections: [
          {
            id: "correction",
            title: "Correction controls",
            questions: [
              {
                control_id: "CORR-01",
                text: "Approved answer",
                type: "text",
                required: true,
              },
              {
                control_id: "CORR-02",
                text: "Answer to revise",
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
    await Response.create([
      {
        workspace_id: workspace._id,
        assessment_id: assessment._id,
        control_id: "CORR-01",
        question_text: "Approved answer",
        response_value: "approved",
      },
      {
        workspace_id: workspace._id,
        assessment_id: assessment._id,
        control_id: "CORR-02",
        question_text: "Answer to revise",
        response_value: "old answer",
      },
    ]);
  });

  test.afterAll(async () => {
    if (assessmentId) {
      await Promise.all([
        Response.deleteMany({ assessment_id: assessmentId }),
        AuditEvent.deleteMany({
          workspace_id: workspaceId,
          entity_id: assessmentId,
        }),
        Assessment.deleteOne({ _id: assessmentId }),
      ]);
    }
    if (engagementId) await Engagement.deleteOne({ _id: engagementId });
  });

  test("reviewer returns only the non-compliant control for correction", async ({
    page,
  }) => {
    await signInInternal(page);
    await page.goto(`/assessments/${assessmentId}`);

    const approved = page
      .locator("div.rounded-md.border", { hasText: "CORR-01" })
      .last();
    const revise = page
      .locator("div.rounded-md.border", { hasText: "CORR-02" })
      .last();
    await approved
      .getByRole("button", { name: "Compliant", exact: true })
      .click();
    await revise
      .getByPlaceholder("Explain what the vendor should change")
      .fill("Attach the current policy");
    const verdictSaved = page.waitForResponse(
      (response) =>
        response.url().includes(`/responses/CORR-02/review`) &&
        response.request().method() === "PATCH",
    );
    await revise
      .getByRole("button", { name: "Non-compliant", exact: true })
      .click();
    expect((await verdictSaved).status()).toBe(200);
    await expect(revise.getByText(/^Saved /)).toBeVisible();

    const resent = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/assessments/${assessmentId}/resend`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Request changes" }).click();
    expect((await resent).status()).toBe(200);
    await expect
      .poll(
        async () => (await Assessment.findById(assessmentId).lean())?.status,
      )
      .toBe("changes_requested");

    const portalToken = await createPortalSessionToken({
      vendorId: DEV_VENDOR_ID,
      workspaceId: workspaceId.toString(),
      spocId: recipientId.toString(),
    });
    await page.context().clearCookies();
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
    await page.getByRole("link", { name: new RegExp(label) }).click();

    await expect(page.getByText("✓ Compliant — locked")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Approved answer *" }),
    ).toBeDisabled();
    await expect(page.getByText("Attach the current policy")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Answer to revise *" }),
    ).toBeEnabled();
  });
});
