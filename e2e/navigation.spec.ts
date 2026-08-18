import { expect, test } from "@playwright/test";
import { signInInternal } from "./helpers";

test("an administrator can reach the primary workspace areas", async ({
  page,
}) => {
  await signInInternal(page);

  const destinations = [
    ["/vendors", "Vendors"],
    ["/templates", "Questionnaire templates"],
    ["/assessments", "Review queue"],
    ["/risks", "Unified Risk Register"],
    ["/sharing", "Cross-Workspace Document Sharing"],
    ["/admin/users", "Workspace Users"],
    ["/admin/workspaces", "Workspaces"],
  ] as const;

  for (const [path, heading] of destinations) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});

test("business owners cannot open admin-only pages", async ({ page }) => {
  await signInInternal(page, "business-owner@mv-vra.local");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Not authorized" }),
  ).toBeVisible();
  await expect(page.getByText("Only an admin can manage users")).toBeVisible();
});
