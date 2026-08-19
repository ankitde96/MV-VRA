import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { Assessment } from "@/lib/db/models/assessment";
import { Engagement } from "@/lib/db/models/engagement";
import { QuestionnaireTemplate } from "@/lib/db/models/questionnaire-template";
import { Vendor } from "@/lib/db/models/vendor";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { dbConnect } from "@/lib/db/connect";
import { DEV_VENDOR_ID } from "@/lib/auth/dev-vendor-credentials";

test.describe("questionnaire recipient scoping", () => {
  let assessmentId: mongoose.Types.ObjectId;
  let excludedAssessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  let primaryEmail: string;
  const label = `Recipient-scoped ${Date.now()}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor, template] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findById(DEV_VENDOR_ID).lean(),
      QuestionnaireTemplate.findOne({ status: "published" }).lean(),
    ]);
    if (
      !workspace ||
      !admin ||
      !vendor ||
      !template ||
      vendor.spocs.length < 2
    ) {
      throw new Error(
        "Recipient E2E requires the documented Stage 2 seed fixtures",
      );
    }
    const primary =
      vendor.spocs.find((spoc) => spoc.is_primary) ?? vendor.spocs[0]!;
    const secondary =
      vendor.spocs.find((spoc) => !spoc.is_primary) ?? vendor.spocs[1]!;
    primaryEmail = primary.email;
    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: label,
      functional_scope: "Disposable recipient-scoping fixture",
      expected_procurement_date: new Date("2030-01-01"),
      data_classification: ["none"],
      status: "in_assessment",
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
      status: "sent",
      recipients: [primary._id],
      assigned_at: new Date(),
      sent_at: new Date(),
      last_activity_at: new Date(),
    });
    assessmentId = assessment._id;
    const excluded = await Assessment.create({
      workspace_id: workspace._id,
      engagement_id: engagement._id,
      vendor_id: vendor._id,
      template_id: template._id,
      template_version: template.version,
      template_name: `${label} hidden`,
      template_snapshot: template.questions_schema,
      status: "sent",
      recipients: [secondary._id],
      assigned_at: new Date(),
      sent_at: new Date(),
      last_activity_at: new Date(),
    });
    excludedAssessmentId = excluded._id;
  });

  test.afterAll(async () => {
    if (assessmentId) await Assessment.deleteOne({ _id: assessmentId });
    if (excludedAssessmentId)
      await Assessment.deleteOne({ _id: excludedAssessmentId });
    if (engagementId) await Engagement.deleteOne({ _id: engagementId });
  });

  async function signIn(page: import("@playwright/test").Page, email: string) {
    await page.goto("/portal/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("Verification code").fill("123456");
    await expect(page).toHaveURL(/\/portal$/);
  }

  test("only the selected SPOC sees the questionnaire", async ({ page }) => {
    await signIn(page, primaryEmail);
    await expect(page.getByText(`${label} v${1}`)).toBeVisible();
    await expect(page.getByText(`${label} hidden v${1}`)).toHaveCount(0);
  });
});
