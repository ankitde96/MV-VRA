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

test("the workspace switcher shows the workspace name instead of its ID", async ({
  page,
}) => {
  await signInInternal(page);

  const membershipResponse = await page.request.get("/api/auth/memberships");
  expect(membershipResponse.ok()).toBeTruthy();
  const membershipData = (await membershipResponse.json()) as {
    current_workspace_id: string;
    memberships: Array<{
      workspace_id: string;
      workspace_name: string;
      role: string;
    }>;
  };
  const currentMembership = membershipData.memberships.find(
    (membership) =>
      membership.workspace_id === membershipData.current_workspace_id,
  );
  expect(currentMembership).toBeTruthy();

  const switcher = page.getByRole("combobox");
  if (!(await switcher.isVisible())) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  }
  await expect(switcher).toContainText(currentMembership!.workspace_name);
  await expect(switcher).not.toContainText(membershipData.current_workspace_id);
  const fitsWithinSidebar = await switcher.evaluate((element) => {
    const sidebar = element.closest('[data-sidebar="sidebar"]');
    if (!sidebar) return false;
    const triggerBounds = element.getBoundingClientRect();
    const sidebarBounds = sidebar.getBoundingClientRect();
    return triggerBounds.right <= sidebarBounds.right;
  });
  expect(fitsWithinSidebar).toBeTruthy();
});

test("business owners cannot open admin-only pages", async ({ page }) => {
  await signInInternal(page, "business-owner@mv-vra.local");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Not authorized" }),
  ).toBeVisible();
  await expect(page.getByText("Only an admin can manage users")).toBeVisible();
});
