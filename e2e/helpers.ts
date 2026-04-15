import type { Page } from "@playwright/test";

export const EMAIL = "danny@onistagency.com";
export const PASSWORD = "1q2w3e4r5t!";

export type Manifest = {
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

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/clients/, { timeout: 20_000 });
}

export async function fetchManifest(page: Page): Promise<Manifest> {
  const res = await page.request.get("/api/test/manifest");
  if (!res.ok()) throw new Error(`Manifest failed: ${res.status()}`);
  return res.json();
}

export async function getVariantId(
  page: Page,
  clientSlug: string,
  designSlug: string,
  variantSlug: string,
): Promise<string> {
  await page.goto(`/clients/${clientSlug}/${designSlug}/${variantSlug}/edit`);
  await page.waitForSelector("iframe[title='Variant preview']", { timeout: 15_000 });
  const id = await page
    .locator("iframe[title='Variant preview']")
    .first()
    .getAttribute("data-variant-id");
  return id ?? "";
}

export async function resetVariant(page: Page, variantId: string) {
  const res = await page.request.post(`/api/test/reset-variant/${variantId}`);
  if (!res.ok()) throw new Error(`Reset failed: ${res.status()}`);
}

export async function freshVariant(
  page: Page,
  clientSlug: string,
  designSlug: string,
  variantSlug: string,
): Promise<string> {
  const id = await getVariantId(page, clientSlug, designSlug, variantSlug);
  if (!id) throw new Error(`No variant id for ${clientSlug}/${designSlug}/${variantSlug}`);
  await resetVariant(page, id);
  await page.reload();
  await page.waitForSelector("iframe[title='Variant preview']", { timeout: 15_000 });
  return id;
}
