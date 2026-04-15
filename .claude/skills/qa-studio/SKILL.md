---
name: qa-studio
description: Run QA checks on the Landing Page Studio app — covers auth, variant chat across all 5 designs, planning chat, bulk edit, delete confirmation, and error handling. Use when shipping changes that touch the AI pipeline, chat UI, or variant CRUD. Invokes Playwright E2E tests against the local dev server.
---

# QA Studio — End-to-end checks for the Landing Page System

## When to use

Run this skill when:
- About to commit/push changes that touch the chat pipeline (`src/lib/generate.ts`, `src/lib/plan.ts`, any `/api/**` route)
- After upgrading Anthropic SDK / Prisma / Auth.js
- Before any demo or deploy to Vercel
- A regression is suspected — "did this break the keto variant again?"

## Prerequisites

1. **Dev server running** on `http://localhost:3000`. If not:
   ```bash
   cd "c:/Users/Daniel Gargano/Documents/Claude Projects/landing-page-system-2"
   npm run dev
   ```
   Wait for "Ready in …" before invoking this skill.

2. **Database seeded**. If seed is stale (e.g. after schema change):
   ```bash
   npm run seed
   ```

3. **Anthropic API key** set in `.env.local` with credit remaining. Test calls cost ~$0.02 total.

## What gets tested

### Smoke (`e2e/smoke.spec.ts`) — ~20 seconds
Fast happy path. Always run first.

1. Login with admin credentials → lands on /clients → MightyMeals card visible
2. Variant chat: simple DOM edit (urgency banner text) updates preview live
3. Error handling: mocked 500 surfaces cleanly, composer re-enables

### Full QA (`e2e/full-qa.spec.ts`) — comprehensive, rate-limit-bound
Data-driven: reads manifest at spec-load via `globalSetup` and creates one test per design discovered in DB. New clients/designs added to the DB automatically get tested on the next run.

**⚠ Rate-limit caveat**: running ~5+ Claude calls back-to-back on Anthropic tier-1 (50k tokens/min for Haiku) causes retry-backoff storms (one test balloons to 2+ min). Either:
- Run this overnight / when you're not doing other API work
- Request a tier upgrade at console.anthropic.com
- Or limit to one design per run via `--grep`

Covers: auth + navigation, variant chat per design, `update_js_data`, bulk edit SSE, delete confirmation UI, error recovery.

## How to run

### Smoke only (fast)
```bash
cd "c:/Users/Daniel Gargano/Documents/Claude Projects/landing-page-system-2"
npx playwright test e2e/smoke.spec.ts --project=chromium
```

### Full suite
```bash
cd "c:/Users/Daniel Gargano/Documents/Claude Projects/landing-page-system-2"
npx playwright test e2e/full-qa.spec.ts --project=chromium
```

### Single test by grep
```bash
npx playwright test --grep "variant chat"
```

### Debug a failure (headed browser, paused)
```bash
npx playwright test e2e/smoke.spec.ts --headed --debug
```

### View last run's trace/video/screenshots
```bash
npx playwright show-report
```
Or directly open `test-results/<test-name>/` which contains the trace.zip, video.webm, and failure screenshot.

## Hermetic state

Tests reset variant state via a dev-only API:
- `POST /api/test/reset-variant/[id]` — clears message history and resets HTML to `design.baseHtml`. Disabled in production.

This means tests can run repeatedly without history accumulation causing rate-limit issues.

## Rate limit notes

Anthropic tier 1 = 50k tokens/min for Haiku 4.5 (editor) and Sonnet 4.6 (planner). Full-qa.spec.ts sends ~9 Claude calls at ~28k tokens each. Running in serial mode with 3-5s pauses between Claude-heavy tests keeps us under the limit.

If you get `rate_limit_error` in `npm run dev` logs:
- Wait 60 seconds and re-run the failing test
- Or check if Anthropic console shows limit, request tier upgrade

## Common failure modes + fixes

| Symptom                                          | Fix                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Login test times out                             | Dev server not running, or port 3000 blocked by zombie Node process                    |
| Variant chat iframe never updates with phrase    | Claude's selector missed. Check dev log for `[generate] ...` output — most common       |
| Bulk edit never shows "done"                     | SSE controller closed prematurely. Should not happen after the ERR_INVALID_STATE fix   |
| Test-run errors with `rate_limit_error`          | Cache TTL expired. Add `page.waitForTimeout(10_000)` between Claude-heavy tests        |
| Prisma connection "Can't reach database server"  | Prisma Postgres went idle — retry once. Persistent = check Vercel Storage dashboard    |

## Exit criteria

All tests green. If a test fails, look at:
1. The failure screenshot (`test-results/*/test-failed-*.png`)
2. The trace (`npx playwright show-trace test-results/*/trace.zip`)
3. The dev server log for `[generate]` diagnostic lines showing what tools Claude called and why

Don't commit or push until smoke passes. Full-qa should pass before any deploy to Vercel.
