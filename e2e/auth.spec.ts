import { expect, test } from "@playwright/test";
import { signInInternal } from "./helpers";

test("protected pages redirect to internal sign in and return after login", async ({
  page,
}) => {
  await page.goto("/vendors");
  await expect(page).toHaveURL(/\/login\?from=%2Fvendors$/);
  await page.getByLabel("Email").fill("admin@mv-vra.local");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/vendors$/);
  await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();
});

test("invalid credentials stay on the login page with a safe error", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("unknown@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("internal and portal sessions remain isolated", async ({ page }) => {
  await signInInternal(page);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/login\?from=%2Fportal$/);
  await expect(
    page.getByRole("heading", { name: "Vendor sign in" }),
  ).toBeVisible();
});
