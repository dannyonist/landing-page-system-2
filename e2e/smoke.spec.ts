import { test, expect } from "@playwright/test";
import { login, freshVariant } from "./helpers";

test.describe.configure({ mode: "serial" });

test("login + landing on clients page shows MightyMeals", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "MightyMeals" }).first()).toBeVisible();
});

test("variant chat: simple DOM edit updates preview", async ({ page }) => {
  await login(page);
  await freshVariant(page, "mightymeals", "editorial", "abandon");

  const iframe = page.locator("iframe[title='Variant preview']").first();
  const initialSrcdoc = await iframe.getAttribute("srcdoc");
  expect(initialSrcdoc).not.toBeNull();

  const uniquePhrase = `PWTEST-${Date.now()}`;
  const chatInput = page.locator('textarea[placeholder*="Describe changes"]');
  await chatInput.click();
  await chatInput.fill(
    `Change the urgency banner copy so it contains the exact phrase "${uniquePhrase}".`,
  );
  await page.keyboard.press("Enter");

  await expect(async () => {
    const current = await iframe.getAttribute("srcdoc");
    expect(current).toContain(uniquePhrase);
  }).toPass({ timeout: 90_000 });
});

test("variant chat: error is surfaced cleanly when request fails", async ({ page }) => {
  await login(page);
  await freshVariant(page, "mightymeals", "editorial", "vegan");

  await page.route("**/api/variants/*/messages", (route) =>
    route.fulfill({
      status: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Simulated failure" }),
    }),
  );

  const chatInput = page.locator('textarea[placeholder*="Describe changes"]');
  await chatInput.fill("trigger a failure");
  await page.keyboard.press("Enter");

  await expect(page.getByText(/Simulated failure|went wrong|⚠/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
