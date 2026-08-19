import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { Assessment } from "@/lib/db/models/assessment";
import { Engagement } from "@/lib/db/models/engagement";
import { QuestionnaireTemplate } from "@/lib/db/models/questionnaire-template";
import { Vendor } from "@/lib/db/models/vendor";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { dbConnect } from "@/lib/db/connect";
import { DEV_VENDOR_ID } from "@/lib/auth/dev-vendor-credentials";
import { signInInternal } from "./helpers";

test.describe("send questionnaire recipients", () => {
  let assessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  let primaryId: mongoose.Types.ObjectId;
  let secondaryEmail: string;
  const label = `Send modal ${Date.now()}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor, template] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findById(DEV_VENDOR_ID).lean(),
      QuestionnaireTemplate.findOne({ status: "published" }).lean(),
    ]);
    if (!workspace || !admin || !vendor || !template || vendor.spocs.length < 2)
      throw new Error("Send E2E requires documented seed fixtures");
    const primary =
      vendor.spocs.find((spoc) => spoc.is_primary) ?? vendor.spocs[0]!;
    const secondary =
      vendor.spocs.find((spoc) => !spoc.is_primary) ?? vendor.spocs[1]!;
    primaryId = primary._id;
    secondaryEmail = secondary.email;
    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: label,
      functional_scope: "Disposable send-modal fixture",
      expected_procurement_date: new Date("2030-01-01"),
      data_classification: ["none"],
      status: "tiered",
    });
    engagementId = engagement._id;
    const assessment = await Assessment.create({
      workspace_id: workspace._id,
      engagement_id: engagement._id,
      vendor_id: vendor._id,
      template_id: template._id,
      template_version: template.version,
      template_name: label,
      template_snapshot: template.questions_schema,
      status: "draft",
      assigned_at: new Date(),
    });
    assessmentId = assessment._id;
  });

  test.afterAll(async () => {
    if (assessmentId) {
      await AuditEvent.deleteMany({ entity_id: assessmentId });
      await Assessment.deleteOne({ _id: assessmentId });
    }
    if (engagementId) await Engagement.deleteOne({ _id: engagementId });
  });

  test("sends to only the checked SPOC", async ({ page }) => {
    await signInInternal(page);
    await page.goto(`/vendors/${DEV_VENDOR_ID}`);
    const engagement = page.getByRole("listitem").filter({ hasText: label });
    await engagement
      .getByRole("button", { name: "Send questionnaire" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText(secondaryEmail).click();
    const sent = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/assessments/${assessmentId}/send`) &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Send questionnaire" }).click();
    expect((await sent).status()).toBe(200);
    const stored = await Assessment.findById(assessmentId).lean();
    expect(stored?.status).toBe("sent");
    expect(stored?.recipients.map(String)).toEqual([primaryId.toString()]);
    expect(stored?.sent_at).toBeInstanceOf(Date);
    expect((await Engagement.findById(engagementId))?.status).toBe(
      "in_assessment",
    );
  });
});
