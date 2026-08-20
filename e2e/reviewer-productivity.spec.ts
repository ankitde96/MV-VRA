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
import { signInInternal } from "./helpers";

test.describe("reviewer productivity", () => {
  let assessmentId: mongoose.Types.ObjectId;
  let engagementId: mongoose.Types.ObjectId;
  let workspaceId: mongoose.Types.ObjectId;
  let responseIds: mongoose.Types.ObjectId[] = [];
  const label = `Reviewer productivity ${Date.now()}`;

  test.beforeAll(async () => {
    await dbConnect();
    const [workspace, admin, vendor] = await Promise.all([
      Workspace.findOne({ slug: "default" }).lean(),
      User.findOne({ email: "admin@mv-vra.local" }).lean(),
      Vendor.findOne({ domain: "apex-cloud.demo.mv-vra.local" }).lean(),
    ]);
    if (!workspace || !admin || !vendor || vendor.spocs.length === 0) {
      throw new Error(
        "Reviewer-productivity E2E requires the documented seed fixtures",
      );
    }
    workspaceId = workspace._id;
    const recipient =
      vendor.spocs.find((spoc) => spoc.is_primary) ?? vendor.spocs[0]!;
    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: label,
      functional_scope: "Disposable reviewer-productivity fixture",
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
            id: "productivity-a",
            title: "Productivity controls",
            questions: [
              {
                control_id: "PROD-01",
                text: "Encryption at rest is enforced",
                type: "text",
                required: true,
              },
              {
                control_id: "PROD-02",
                text: "Privileged access is reviewed",
                type: "text",
                required: true,
              },
              {
                control_id: "PROD-03",
                text: "Incident exercises are completed",
                type: "text",
                required: true,
              },
              {
                control_id: "PROD-04",
                text: "Suppressed follow-up",
                type: "text",
                required: true,
                show_if: {
                  all: [{ control_id: "PROD-01", op: "eq", value: "show" }],
                },
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
        control_id: "PROD-01",
        question_text: "Encryption at rest is enforced",
        response_value: "hide",
      },
      {
        workspace_id: workspace._id,
        assessment_id: assessment._id,
        control_id: "PROD-02",
        question_text: "Privileged access is reviewed",
        response_value: "yes",
      },
      {
        workspace_id: workspace._id,
        assessment_id: assessment._id,
        control_id: "PROD-03",
        question_text: "Incident exercises are completed",
        response_value: "yes",
      },
    ]);
    responseIds = responses.map((response) => response._id);
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
          entity_id: { $in: responseIds },
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
  });

  test("persists the unmarked filter and keyboard focus after marking and refresh", async ({
    page,
  }) => {
    await signInInternal(page);
    await page.goto(`/assessments/${assessmentId}`);

    const progress = page.getByRole("progressbar", { name: "Review progress" });
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    await expect(
      page.getByText("0 / 3 reviewed", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show keyboard shortcuts" }).click();
    await expect(
      page.getByRole("heading", { name: "Review keyboard shortcuts" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.keyboard.press("/");
    await expect(
      page.getByRole("searchbox", { name: "Search review controls" }),
    ).toBeFocused();

    const unmarked = page.getByRole("button", { name: /^Unmarked 3$/ });
    await unmarked.click();
    await expect(unmarked).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/review=unmarked/);
    await expect(page.locator('[data-review-control="PROD-04"]')).toHaveCount(
      0,
    );

    await page.keyboard.press("j");
    await expect(page).toHaveURL(/focus=PROD-01/);
    await expect(page.locator('[data-review-control="PROD-01"]')).toBeFocused();

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/responses/PROD-01/review") &&
        response.request().method() === "PATCH",
    );
    await page.keyboard.press("c");
    expect((await saved).status()).toBe(200);
    await expect(progress).toHaveAttribute("aria-valuenow", "33");
    await expect(
      page.getByText("1 / 3 reviewed", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-review-control="PROD-01"]')).toHaveCount(
      0,
    );
    await expect(page).toHaveURL(/focus=PROD-02/);

    await page.reload();
    await expect(
      page.getByRole("button", { name: /^Unmarked 2$/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/review=unmarked/);
    await expect(page).toHaveURL(/focus=PROD-02/);
    await expect(page.locator('[data-review-control="PROD-02"]')).toBeFocused();
  });
});
