import { expect, test } from "@playwright/test";

test("the seeded vendor can complete the development portal sign-in", async ({
  page,
}) => {
  await page.goto("/portal/login");
  await page.getByLabel("Email").fill("vendor@mv-vra.local");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Verification code").fill("123456");

  await expect(page).toHaveURL(/\/portal$/);
  await expect(
    page.getByRole("heading", { name: "Your assessments" }),
  ).toBeVisible();
});

test("a failed OTP request does not advance to code entry", async ({
  page,
}) => {
  await page.route("**/api/portal/auth/otp/request", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/portal/login");
  await page.getByLabel("Email").fill("vendor@mv-vra.local");
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Verification code")).toHaveCount(0);
  await expect(page.getByText("We couldn't send the code")).toBeVisible();
});
