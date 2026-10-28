# ServeFlow

AI coach and money tool for US restaurant servers: tip logging + forecast, budgeting, labor-law checklist, coach.
Mobile-first PWA, used one-handed between tables. Full roadmap: `docs/PLAN.md` (read it at the start of each phase).

## Stack
- Next.js 16 (App Router, `src/`, Turbopack) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, Row Level Security); migrations in `supabase/migrations/`
- Claude API, called only from server-side code. Zod validates every input **on the server**.
- Recharts (charts), Vitest (unit), Playwright (e2e), Vercel (hosting), Stripe (later)
- Ask before adding any dependency outside this stack.

## Commands
- `npm run dev`: local dev server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript check
- `npm test` / `npm run test:watch` / `npm run test:coverage`: Vitest (see `docs/TESTING.md`)
- `npm run test:rls`: RLS integration tests (needs `SUPABASE_TEST_*` env)
- `npm run test:e2e`: Playwright (first run: `npx playwright install chromium`)
- `npm run backtest`: forecast backtest on simulated data (numbers go in `docs/METRICS.md`)
- `npm run labor:report` / `npm run labor:seed`: labor-law data-quality report / regenerate `supabase/seed/labor_rules.sql` from the JSON

## Product principles
- Never shame the user for a slow night. Below-forecast copy is neutral, never red, never "failure".
- No guaranteed-earnings claims: say "typical" and "based on your history".
- Accuracy over coverage for legal info.
- Fast, one-handed, works on bad Wi-Fi (cache recent data, offline shift logging that syncs later).
- Honest marketing; no inflated promises.

## Labor-law data integrity
- Every rule row has `jurisdiction`, `topic`, `plain_english`, `legal_basis`, `source_url`, `last_verified_at`, `reviewed_by`, `status`.
- Primary sources only (US DOL, state labor departments, statutes). Show source link + "last verified" date in the UI.
- Unclear or employer-dependent answers are "Depends", never a guess. Rules unverified for 90+ days are flagged "needs review".
- Show the "General information, not legal advice" disclaimer. The coach answers legal questions only from this dataset.
- No public launch of legal data before employment-attorney review.

## Security
- RLS on every user table. Never log tip/income amounts. Never build SQL from strings.
- Secrets live only in `.env.local` (never committed, never read by agents).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
