# Testing

## Tools
- **Vitest**: unit and integration tests (`*.test.ts`, next to the code they test).
- **Playwright**: a few end-to-end flows in `e2e/` (logged-out redirect, auth pages, shift logging).

## Running
| Command | What it does |
|---|---|
| `npm test` | Full unit suite once (what CI runs) |
| `npm run test:watch` | Re-run tests on save |
| `npm run test:coverage` | Suite + coverage report (`coverage/index.html`) |
| `npm run test:rls` | RLS integration tests only (needs `SUPABASE_TEST_*`) |
| `npm run test:e2e` | Playwright flows on a phone viewport (builds + starts the app) |
| `npm run labor:report` | Labor-law data-quality report (states, rules, % sourced, stale) |
| `npm run backtest` | Forecast backtest report on simulated data (also a calibration guard in `npm test`) |
| `npm run typecheck` | TypeScript, no emit |

## Always tested
- Forecast math: grouping, percentiles, minimum sample size, % difference, messaging tone
- Take-home and tip-out calculations (`src/lib/budget`: tip-outs on tips or sales, exact-cent splits, safe to spend, slow-week alerts)
- Drills and habits (`src/lib/learn`, `src/lib/daily`): server-side grading (client scores ignored), level unlocks, deterministic menu quizzes, streaks (a slow night counts), daily tasks
- Labor-rule lookup and stale-rule (90+ day) logic (`src/lib/labor`): state rules over the federal baseline, federal fallback clearly labeled, expired rates flagged; a CI quality gate fails if a published rule lacks a primary source, legal basis or verified date, or if `supabase/seed/labor_rules.sql` is out of date
- RLS access policies (integration, against a test database)
- Coach evals (Phase 5)

Coverage expectation: near-complete on `src/lib/forecast/**` and labor-rule logic; meaningful elsewhere.

## Required auth, validation and security suite
Validation happens on the server with Zod. Tests call the schemas/server actions directly, not only the UI.
- **Access control**: logged-out users are redirected from protected pages; one user can't read, edit or delete another user's shifts, budgets or break logs (RLS); unauthenticated requests are rejected; admin-only tables are blocked for normal users; account deletion removes the user's data.
- **Input validation**: usernames reject `!!!`, empty, whitespace, too long, emoji and reserved names (`admin`); tip amounts reject negatives, letters, huge values and >2 decimals; hours, dates and tip-out values reject out-of-range input (40-hour shift, 200% tip-out, tip-outs over 100% of tips, a budget split that doesn't add up to 100).
- **Injection**: SQL (`'; DROP TABLE shifts; --`) and XSS (`<script>alert(1)</script>`) payloads are rejected or stored as plain text and rendered as text. Supabase client only, never string-built SQL.
- **Abuse limits**: rate limits on login, signup (and the coach route later); oversized bodies rejected.
- **Coach (Phase 5)**: prompt-injection prompts are part of the eval set; the coach route requires login.

RLS integration tests run only when `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` and `SUPABASE_TEST_SERVICE_ROLE_KEY` are set (point them at a local or throwaway Supabase project, never production). A static test always checks that every table in `supabase/migrations` enables RLS.

## Adding a test
1. Put it next to the code: `foo.ts` → `foo.test.ts`.
2. Name it by behavior: `it("returns no forecast under 4 shifts")`.
3. Cover the edges: no data, one item, outliers, zero, invalid input.
4. Bug fix? Write the failing test first, then fix, and keep the test.
5. Run `npm test` before calling it done.
