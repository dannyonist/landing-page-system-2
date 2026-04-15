import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { login, resetVariant } from "./helpers";

/**
 * Fully data-driven QA — discovers clients/designs/variants at spec-load time
 * via /api/test/manifest. New clients or designs added to the DB get tested
 * automatically on the next run with NO code changes.
 *
 * Each design gets its own test so one slow/failing design doesn't block the rest.
 *
 * Serial mode + 6s delays keep us under Anthropic token rate limits.
 */
test.describe.configure({ mode: "serial", timeout: 300_000 });

type Manifest = {
  clients: Array<{
    id: string;
    slug: string;
    name: string;
    designs: Array<{
      id: string;
      slug: string;
      name: string;
      variants: Array<{ id: string; slug: string; name: string }>;
    }>;
  }>;
};

// Read manifest written by globalSetup (Playwright's loader is CJS, no TLA).
const manifestPath = resolve(process.cwd(), "e2e/.manifest.json");
const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
if (manifest.clients.length === 0) {
  throw new Error("Manifest has no clients — seed the DB first: `npm run seed`");
}

// Flatten: [client, design, variant-to-test] tuples
const designTargets = manifest.clients.flatMap((client) =>
  client.designs
    .filter((d) => d.variants.length > 0)
    .map((design) => ({
      client,
      design,
      variant: design.variants[0], // use first variant per design as canary
    })),
);

test("manifest + clients page lists every client and design from DB", async ({ page }) => {
  await login(page);
  await page.goto("/clients");
  for (const c of manifest.clients) {
    await expect(page.getByRole("heading", { name: c.name }).first()).toBeVisible();
  }
  for (const c of manifest.clients) {
    await page.goto(`/clients/${c.slug}`);
    for (const d of c.designs) {
      await expect(page.getByRole("heading", { name: d.name }).first()).toBeVisible();
    }
  }
});

for (const { client, design, variant } of designTargets) {
  test(`chat edit on ${client.name} / ${design.name}`, async ({ page }) => {
    // 4min per test: 3min for Claude (accounting for rate-limit retries) + overhead.
    test.setTimeout(240_000);
    await login(page);
    await resetVariant(page, variant.id);

    await page.goto(
      `/clients/${client.slug}/${design.slug}/${variant.slug}/edit`,
    );
    const iframe = page.locator("iframe[title='Variant preview']").first();
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    const uniquePhrase = `PW-${design.slug}-${Date.now().toString().slice(-6)}`;
    const chatInput = page.locator('textarea[placeholder*="Describe changes"]');
    await chatInput.click();
    await chatInput.fill(
      `Change the urgency banner copy so it contains the exact phrase "${uniquePhrase}".`,
    );
    await page.keyboard.press("Enter");

    await expect(async () => {
      const current = await iframe.getAttribute("srcdoc");
      expect(current).toContain(uniquePhrase);
    }).toPass({ timeout: 200_000 });

    // Generous cushion between Claude tests to stay under per-minute token rate.
    await page.waitForTimeout(15_000);
  });
}

test("update_js_data replaces an inline const", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);

  const target = designTargets[0];
  const testVariant = target.design.variants[1] ?? target.variant;
  await resetVariant(page, testVariant.id);

  await page.goto(
    `/clients/${target.client.slug}/${target.design.slug}/${testVariant.slug}/edit`,
  );
  const iframe = page.locator("iframe[title='Variant preview']").first();
  await expect(iframe).toBeVisible();

  const uniqueMeal = `PWMeal-${Date.now().toString().slice(-6)}`;
  const chatInput = page.locator('textarea[placeholder*="Describe changes"]');
  await chatInput.click();
  await chatInput.fill(
    `Inspect the inline <script> for data const(s). Use update_js_data to replace the first meal/item's name with "${uniqueMeal}". Keep the object shape intact.`,
  );
  await page.keyboard.press("Enter");

  await expect(async () => {
    const current = await iframe.getAttribute("srcdoc");
    expect(current).toContain(uniqueMeal);
  }).toPass({ timeout: 120_000 });
});

test("bulk edit applies in parallel via SSE", async ({ page }) => {
  test.setTimeout(360_000);
  await login(page);

  const target = designTargets[0];
  const targets = target.design.variants.slice(0, 3);
  expect(targets.length).toBeGreaterThanOrEqual(2);

  for (const v of targets) {
    await resetVariant(page, v.id);
  }

  await page.goto(
    `/clients/${target.client.slug}/${target.design.slug}/bulk-edit`,
  );
  await expect(page.getByRole("heading", { name: "Edit all variants" })).toBeVisible();

  const uniquePhrase = `PWBulk-${Date.now().toString().slice(-6)}`;
  const composer = page.locator("textarea").first();
  await composer.click();
  await composer.fill(
    `Change the urgency banner copy to include the exact phrase "${uniquePhrase}".`,
  );

  await page.getByRole("button", { name: /clear/i }).click();
  for (const v of targets) {
    await page
      .locator(`label:has(div:has-text("/${v.slug}"))`)
      .first()
      .locator("input[type='checkbox']")
      .check();
  }

  await page.getByRole("button", { name: /apply to \d+ variants/i }).click();

  await expect(
    page.getByText(/Bulk edit complete/i).first(),
  ).toBeVisible({ timeout: 240_000 });
});

test("delete-variant confirmation UI works (cancel path)", async ({ page }) => {
  await login(page);
  const target = designTargets[0];

  await page.goto(`/clients/${target.client.slug}/${target.design.slug}`);
  const card = page
    .locator("[class*='rounded-2xl'][class*='border']")
    .filter({ has: page.locator("button[title='Delete variant']") })
    .first();
  await expect(card).toBeVisible();
  await card.hover();
  await card.locator("button[title='Delete variant']").click();
  await expect(card.getByRole("button", { name: /cancel/i })).toBeVisible();
  await card.getByRole("button", { name: /cancel/i }).click();
  await expect(card.getByRole("button", { name: /cancel/i })).not.toBeVisible();
});

test("chat UI recovers from server error without hanging", async ({ page }) => {
  await login(page);
  const target = designTargets[0];
  const variant = target.design.variants[target.design.variants.length - 1];

  await resetVariant(page, variant.id);
  await page.goto(
    `/clients/${target.client.slug}/${target.design.slug}/${variant.slug}/edit`,
  );

  await page.route("**/api/variants/*/messages", (route) =>
    route.fulfill({
      status: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Injected fault" }),
    }),
  );

  const chatInput = page.locator('textarea[placeholder*="Describe changes"]');
  await chatInput.fill("trigger server error");
  await page.keyboard.press("Enter");

  await expect(
    page.getByText(/Injected fault|went wrong|⚠/i).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(chatInput).toBeEnabled({ timeout: 5_000 });
});
