import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { Assessment } from "@/lib/db/models/assessment";
import { Engagement } from "@/lib/db/models/engagement";
import { QuestionnaireTemplate } from "@/lib/db/models/questionnaire-template";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Workspace } from "@/lib/db/models/workspace";
import { dbConnect } from "@/lib/db/connect";
import { DEV_VENDOR_ID } from "@/lib/auth/dev-vendor-credentials";
import { signInInternal } from "./helpers";

test.describe("mobile draft checklist editor", () => {
  let assessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  const fixtureLabel = `Stage 3 mobile editor ${Date.now()}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor, template] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findById(DEV_VENDOR_ID).lean(),
      QuestionnaireTemplate.findOne({ status: "published" }).lean(),
    ]);
    if (!workspace || !admin || !vendor || !template) {
      throw new Error(
        "Stage 3 mobile E2E fixture requires db:seed and db:seed-questionnaire",
      );
    }

    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: fixtureLabel,
      functional_scope: "Disposable Playwright checklist fixture",
      expected_procurement_date: new Date("2030-01-01T00:00:00.000Z"),
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
      template_name: fixtureLabel,
      template_snapshot: {
        sections: [
          {
            id: "mobile-section",
            title: "Mobile section",
            questions: [
              {
                control_id: "MOBILE-01",
                text: "Original mobile question",
                type: "text",
                required: true,
              },
            ],
          },
        ],
      },
      status: "draft",
      assigned_at: new Date(),
      due_date: null,
    });
    assessmentId = assessment._id;
  });

  test.afterAll(async () => {
    if (assessmentId) {
      await Promise.all([
        AuditEvent.deleteMany({ entity_id: assessmentId }),
        Assessment.deleteOne({ _id: assessmentId }),
      ]);
    }
    if (engagementId) {
      await Engagement.deleteOne({ _id: engagementId });
    }
    await mongoose.disconnect();
  });

  test("adds, edits, saves, and deletes a question without horizontal overflow", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !isMobile,
      "The Stage 3 gate specifically requires mobile coverage",
    );
    await signInInternal(page);
    await page.goto(`/vendors/${DEV_VENDOR_ID}`);

    const engagement = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Add question" }) })
      .filter({ hasText: fixtureLabel })
      .last();
    await expect(engagement).toBeVisible();
    await engagement.getByRole("button", { name: "Add question" }).click();

    const questionCards = engagement
      .getByRole("button", { name: "Remove question" })
      .locator("..");
    await expect(questionCards).toHaveCount(2);

    await questionCards
      .first()
      .locator("input")
      .nth(1)
      .fill("Edited on mobile");
    await questionCards
      .last()
      .locator('input[placeholder="HOST-01"]')
      .fill("MOBILE-02");
    await questionCards.last().locator("input").nth(1).fill("Added on mobile");

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/assessments/${assessmentId}/checklist`) &&
        response.request().method() === "PATCH",
    );
    await engagement.getByRole("button", { name: "Save checklist" }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(page.getByText("Checklist saved.")).toBeVisible();

    const saved = await Assessment.findById(assessmentId).lean();
    const savedQuestions = saved?.template_snapshot.sections[0].questions;
    expect(savedQuestions).toMatchObject([
      { control_id: "MOBILE-01", text: "Edited on mobile" },
      { control_id: "MOBILE-02", text: "Added on mobile" },
    ]);

    await questionCards
      .last()
      .getByRole("button", { name: "Remove question" })
      .click();
    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/assessments/${assessmentId}/checklist`) &&
        response.request().method() === "PATCH",
    );
    await engagement.getByRole("button", { name: "Save checklist" }).click();
    expect((await deleteResponse).status()).toBe(200);
    await expect(questionCards).toHaveCount(1);

    const afterDelete = await Assessment.findById(assessmentId).lean();
    expect(afterDelete?.template_snapshot.sections[0].questions).toMatchObject([
      { control_id: "MOBILE-01", text: "Edited on mobile" },
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  });
});
