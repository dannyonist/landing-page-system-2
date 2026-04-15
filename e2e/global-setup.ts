import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Playwright globalSetup — runs ONCE before any tests.
 * Fetches the app's manifest (clients → designs → variants) from the dev server
 * and writes it to e2e/.manifest.json so test specs can read it synchronously at
 * module load time (Playwright's loader doesn't support top-level await).
 */
export default async function globalSetup() {
  const res = await fetch("http://localhost:3000/api/test/manifest");
  if (!res.ok) {
    throw new Error(
      `Manifest unreachable (${res.status}). Is the dev server running on :3000?`,
    );
  }
  const manifest = await res.json();
  const target = resolve(process.cwd(), "e2e/.manifest.json");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(
    `[globalSetup] Wrote manifest: ${manifest.clients.length} client(s), ${manifest.clients.reduce(
      (n: number, c: { designs: unknown[] }) => n + c.designs.length,
      0,
    )} design(s)`,
  );
}
