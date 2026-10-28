# ServeFlow: Project Guide

A complete walkthrough of what ServeFlow does, how it's built, why each decision was made, how quality was verified, and the questions an interviewer is likely to ask.

> **How to read the status markers.** Everything in this guide describes code that exists in this repo. Two things depend on accounts that are set up outside the code: the **live deployment** (Vercel + Supabase) and the **live coach eval** (Claude via Amazon Bedrock). Their procedures are fully documented below; their results are marked **⬜ TO FILL** until they've been run. Never quote a number that is still marked ⬜.

---

## Contents

1. [Status at a glance](#1-status-at-a-glance)
2. [What ServeFlow is](#2-what-serveflow-is)
3. [Feature tour](#3-feature-tour)
4. [Architecture](#4-architecture)
5. [Technology choices and why](#5-technology-choices-and-why)
6. [Data model](#6-data-model)
7. [Security](#7-security)
8. [The tip forecast engine and backtest](#8-the-tip-forecast-engine-and-backtest)
9. [Budgeting math](#9-budgeting-math)
10. [Daily habits, drills and streaks](#10-daily-habits-drills-and-streaks)
11. [The labor-law dataset](#11-the-labor-law-dataset)
12. [The AI Server Coach](#12-the-ai-server-coach)
13. [The coach eval](#13-the-coach-eval)
14. [Testing and CI/CD](#14-testing-and-cicd)
15. [Deployment](#15-deployment)
16. [The résumé bullets, explained](#16-the-résumé-bullets-explained)
17. [Interview questions and answers](#17-interview-questions-and-answers)
18. [Limitations and what I'd do next](#18-limitations-and-what-id-do-next)
19. [Numbers cheat sheet](#19-numbers-cheat-sheet)

---

## 1. Status at a glance

| Area | Status | Evidence |
|---|---|---|
| Auth, RLS, account deletion | Built and tested | `supabase/migrations/`, `supabase/tests/*.rls.test.ts`, `src/app/(app)/account/` |
| Shift logging (incl. offline) | Built and tested | `src/components/shifts/`, `src/lib/shifts/` |
| Tip forecast + backtest | Built, tested, measured (simulated data) | `src/lib/forecast/`, `docs/METRICS.md` |
| Budgeting | Built and tested | `src/lib/budget/`, `/budget` |
| Daily habits, streaks, drills, levels | Built and tested | `src/lib/daily/`, `src/lib/learn/` |
| Labor-law dataset (5 states + federal, 32 rules) | Built, sourced, quality-gated | `supabase/seed/labor_rules.json`, `src/lib/labor/` |
| AI coach (Claude API or Amazon Bedrock) | Built and unit-tested with a fake client | `src/lib/coach/`, `src/app/api/coach/` |
| Coach eval set (49 cases) + grader | Built and unit-tested | `evals/coach/cases.json`, `src/lib/coach/eval.ts` |
| CI on every push (GitHub Actions) | Running | `.github/workflows/ci.yml` |
| Live coach eval run on Bedrock | ⬜ TO FILL after AWS setup | `evals/coach/results/<date>.json` |
| Deployed on Vercel | ⬜ TO FILL after deploy | Live URL |
| Stripe, community, PWA install (Phase 6) | Not started (out of scope so far) | `docs/PLAN.md` |

---

## 2. What ServeFlow is

**One sentence:** an AI coach and money tool for US restaurant servers: log tips in seconds, see what a shift typically pays, budget around an irregular income, know your rights at work, and get better at the job.

**Who it's for:** a tipped server, on a phone, often between tables or right after a shift. That one fact drives most design decisions: mobile-first, one-handed, big tap targets, fast logging, and it has to work on bad restaurant Wi-Fi.

**The problem.** Servers' income swings night to night. Most budgeting apps assume a paycheck. Servers also get confusing, often wrong information about breaks, tip pools and tip credits, and the rules differ by state.

**Three pillars:**

1. **Money:** tip logging, a "typical range" forecast for each kind of shift, take-home after tip-outs, a budget split, and "safe to spend this week".
2. **Rights:** a sourced, state-aware checklist (Yes / No / Depends) and a private break log.
3. **Skills:** daily habits with streaks, practice drills and levels, quizzes on your own menu, and an AI coach.

**Product principles** (enforced in code and tests, not just stated):

- Never shame a slow night. Below-forecast copy is neutral, never red, never "failure". A test greps alert copy for shaming words.
- No guaranteed-earnings claims. Forecasts are ranges labeled "based on your history".
- Accuracy over coverage for legal info: 5 states done right, not 50 done loosely.
- Honest marketing and honest metrics: simulated data is labeled simulated.

---

## 3. Feature tour

The app has a bottom tab bar (Report, Learn, Coach, Rights, Daily), plus Log, Budget and Account screens.

### Report (home)
- The last shift's take-home next to its typical range ("+14.6% above your typical Friday dinner", or a neutral "Slower than usual. Tuesdays vary.").
- Average per shift, a typical month's take-home, weekly/monthly trend charts (Recharts).
- "Your typical shifts": the p25–p75 range for each weekday + shift type you work, once each has 4+ samples.
- A link to the Budget with this week's safe-to-spend number.

### Log a shift
- Built to take under 15 seconds: amount field autofocused, date and lunch/dinner guess pre-filled, one tap to save.
- A live forecast preview as you type.
- Optional details: cash/card split, tip-out, hours, tables, tags (rainy, slow section, holiday, short-staffed, event nearby), notes.
- **Automatic tip-out:** leave tip-out blank and the server computes it from your settings (for example 5% of tips to the bar plus 1.5% of sales to the busser).
- **Offline:** with no connection, the shift is saved on the phone and synced later. A retried sync can't create a duplicate.

### Budget
- **Safe to spend this week:** the spending share of a cautious week, meaning what you've made so far plus 80% of what's typical for your usual shifts still ahead.
- A typical range for the week, where your last shift goes (bills / savings / spending / taxes), and a typical month split.
- Neutral slow-week alerts: this week running lighter than usual, and weeks that were slow the same time last year.

### Learn
- Level 1 (Basics) and Level 2 (Upselling): 8 drills, 40 questions with instant explanations. 80% passes; Level 2 unlocks after Level 1. Levels 3–4 are shown as coming later.
- **Your menu:** add dishes, ingredients and allergens, then get quizzed ("What's in the Calamari?", "Which of these contains sesame?").

### Daily
- A streak plus three tasks a day: log tonight's tips, today's drill, and a rotating habit (memorize 3 menu items, practice your greeting, and so on).
- Any activity counts toward the streak. A logged slow night counts the same as a great one.

### Rights
- Pick your state. You get 7 questions answered Yes / No / Depends, each with a plain-English explanation, source link, legal basis and "last verified" date. A federal baseline sits under each state rule.
- Stale rules (90+ days unverified, or a dollar rate past its expiry date) show a "needs review" warning.
- The disclaimer "General information, not legal advice", a "not yet attorney-reviewed" notice, and a link to the state labor department.
- **Break log:** a private record of missed, short or interrupted breaks.
- **Admin review page** (admins only): re-verify a rule or change its status.

### Coach
- Chat about serving (rude tables, upselling, big parties) and workplace rights.
- Legal answers come only from the verified rules for your state, shown with their sources. Anything not covered gets "I don't have verified information on that" plus where to ask.

### Account
- Sign out, and **delete account**, which removes the profile and every row of user data through cascading deletes.

---

## 4. Architecture

```
            Phone browser (React client components)
                 │  HTTPS
                 ▼
 ┌──────────────────────────────────────────────────────────┐
 │ Next.js 16 on Vercel                                     │
 │                                                          │
 │  proxy.ts ── refreshes the Supabase session cookie and   │
 │              redirects signed-out users from protected   │
 │              pages                                       │
 │                                                          │
 │  Server Components ── read data (RLS applies)            │
 │  Server Actions ───── every mutation: auth check →       │
 │                       rate limit → Zod → DB write        │
 │  Route handler ────── POST /api/coach                    │
 │                                                          │
 │  src/lib/* ── pure TypeScript logic (forecast, budget,   │
 │               streaks, labor lookup, coach guard).       │
 │               No I/O, so it's unit-tested directly.      │
 └───────┬──────────────────────────────────┬───────────────┘
         │ supabase-js (user's JWT)         │ Anthropic SDK (server only)
         ▼                                  ▼
 ┌─────────────────────────┐   ┌──────────────────────────────────┐
 │ Supabase                │   │ Claude Opus 5.5                  │
 │ Postgres + Auth + RLS   │   │  • Claude API (default), or      │
 │ 8 tables, CHECK         │   │  • Claude in Amazon Bedrock      │
 │ constraints, cascades   │   │    (COACH_PROVIDER=bedrock)      │
 └─────────────────────────┘   └──────────────────────────────────┘
```

**Layering rule:** UI components are thin. All logic with rules in it lives in `src/lib/` as pure functions (input → output, no database, no clock). Today's date is passed in. That's why the forecast, budget, streak, labor lookup and coach guard can have hundreds of fast, deterministic unit tests.

**Server Actions vs. a route handler.** Forms and mutations use Server Actions (type-safe calls, progressive enhancement). The coach uses a route handler (`POST /api/coach`) because it's a JSON API with its own status codes (401, 413, 429, 503), which is also easier to rate-limit and to test with plain `Request` objects.

**Where "today" comes from.** Shift dates are calendar days. Screens that depend on "today" (Report, Budget, Daily) render on the client using the phone's local date, so a server in UTC can't put a 10 p.m. shift on the wrong day. All date math is done on `YYYY-MM-DD` strings in UTC, so DST can't shift a day.

### Request flow: logging a shift
1. Client form → `logShift(payload)` Server Action.
2. The session's user id comes from a verified JWT (`getClaims`), never from the input.
3. Per-user rate limit (60 shifts/hour), then Zod validation: money parsed to **integer cents**, dates bounded, tags whitelisted.
4. Blank tip-out: the user's budget settings are loaded and the tip-out is computed on the server.
5. Insert through supabase-js (parameterized). RLS checks `auth.uid() = user_id`. A unique `(user_id, client_id)` index makes offline retries idempotent.
6. `revalidatePath` refreshes Report and Daily.

### Request flow: asking the coach
1. `POST /api/coach` → verify session (401 if none) → reject bodies over 32 KB (413) → per-user limit of 30/hour (429) → Zod-validate the alternating message history (400).
2. Load the user's state and the visible labor rules, then keep only that state's rules plus federal ones.
3. Call Claude with structured output. A fixed, cached system prompt comes first; the user's rules follow in a second block.
4. **Guard:** check cited rule ids against the rules we sent. An uncovered or uncited legal answer is replaced with fixed "no verified info" wording.
5. Return the reply. Sources come from our database, never from the model's text.

---

## 5. Technology choices and why

| Choice | Why | Alternatives considered |
|---|---|---|
| **TypeScript** | One language across UI, server and tests. Types catch whole classes of bugs (money as `number` vs cents, missing union cases like `"locked" \| "ready"` forecasts). Shared types between client and server. | Plain JS (no safety), separate Go/Python backend (two languages, more setup for no gain at this scale) |
| **Next.js 16 (App Router)** | One codebase for pages and server code; Server Components read data on the server; Server Actions give type-safe mutations; first-class on Vercel. | SPA + separate API (more moving parts), Remix |
| **Supabase (Postgres)** | A real relational database plus Auth plus Row Level Security, with no backend server to run. Free tier. SQL migrations in the repo. | Firebase (NoSQL, weaker for relational data and aggregate queries), self-hosted Postgres + custom auth (more work, more risk) |
| **Row Level Security** | Access control enforced *in the database*: even a bug in app code can't return another user's tips. | App-level checks only (one missed `WHERE` = data leak) |
| **Zod** | Validates every input on the server; one schema defines rules, error messages and the parsed type. | Hand-written checks (inconsistent), client-only validation (bypassable) |
| **Tailwind v4 + shadcn/ui** | Fast, consistent mobile UI; accessible components we own (copied into the repo, not a black-box dependency). | Component libraries with heavy runtime styling |
| **Recharts** | Simple React charts for trends. | D3 (more code), chart.js |
| **Vitest + Playwright** | Vitest is fast and TS-native for unit tests; Playwright drives a real phone-sized browser for end-to-end flows. | Jest (slower TS setup), Cypress |
| **Claude (Opus 5.5)** | Strong instruction-following and structured output, which matters for "answer only from these rules". Called only from the server so the key never reaches the browser. | Other LLMs (would need re-evaluation; the eval set is how I'd compare) |
| **Amazon Bedrock as a provider** | Same model and API shape through AWS (AWS billing, credentials and data boundary). Switching is one env var. | Claude API only |
| **Vercel** | Deploys from GitHub on every push; preview URL per PR; free Hobby plan. | Netlify, self-hosting |

### Why a relational database?
The data is naturally relational and the reads are aggregates:

- Every table hangs off one user (`auth.users`). Foreign keys with `ON DELETE CASCADE` make **account deletion a single, reliable operation**: delete the auth user and every shift, setting, attempt, dish and break log goes with it.
- The forecast needs "this user's shifts, filtered by weekday and type, ordered by date": a natural indexed SQL query (`shifts_user_date_idx`).
- **CHECK constraints** enforce the same rules as Zod at the last line of defense: tip-outs can't exceed tips, a budget split must total 100, a labor rule must have an `https://` source and a known topic.
- **Uniqueness** encodes business rules: one labor rule per `(jurisdiction, topic)`; one offline `client_id` per user.

A document store would push all of that (joins, cascades, constraints) into app code.

### Why TypeScript specifically helped here
- Money is **integer cents** everywhere (`grossCents`), converted only at the database edge. Types make the units obvious.
- Discriminated unions model states the UI must handle: `Forecast = locked | ready`, `CoachResult = ok | error`, `DailyTask = log | drill | habit`. The compiler forces every case to be handled.
- The coach's structured output is a Zod schema, so the model's response is parsed into a typed object instead of a string being trusted.

---

## 6. Data model

8 tables, all in `supabase/migrations/`, all with RLS.

```
auth.users (Supabase Auth)
   │ 1
   ├──< profiles           (id = user id; username, state)
   ├──< shifts             (date, type, gross_tips, tip_out, sales, tags, client_id, ...)
   ├──1 budget_settings    (tip-out % and basis per role, split percentages)
   ├──< drill_attempts     (drill_id, score, total, completed_on)  — no updates allowed
   ├──< task_completions   (task_id, completed_on)  PK (user, task, day)
   ├──< menu_items         (name, description, allergens[])
   └──< break_logs         (shift_date, break_type, outcome, minutes, paid, notes)

labor_rules (shared, not per user)
   id 'ca-meal_break', jurisdiction, topic, answer, plain_english, legal_basis,
   source_url, last_verified_at, valid_through, reviewed_by, status
   UNIQUE (jurisdiction, topic)
```

Every per-user table has `user_id ... references auth.users ON DELETE CASCADE` and `user_id default auth.uid()`.

**Design notes:**
- **Money:** `numeric(10,2)` in the database, integer cents in TypeScript. Floats never hold money.
- **Streaks and levels are computed, not stored.** They derive from shifts, attempts and completions, so they can never drift out of sync.
- **Drill content lives in code, not the database.** It's versioned and reviewed in PRs; only attempts are stored.
- **Labor rules are shared data**, readable by signed-in users, writable only by admins.

---

## 7. Security

| Threat | Defense | Tested by |
|---|---|---|
| User A reads/edits/deletes user B's data | RLS on every table: `auth.uid() = user_id` for select/insert/update/delete | RLS integration suites per table (`supabase/tests/`) |
| Spoofing `user_id` in a request | `user_id` always comes from the verified session; RLS `with check` rejects mismatches | Action tests ("ignores a user_id in the input") + RLS tests |
| Making yourself an admin | Admin = `app_metadata.role` in the JWT, settable only with the service role; `is_admin()` is `security definer` with a pinned `search_path` | RLS test: "can't make yourself an admin by editing your profile" |
| SQL injection | supabase-js only (parameterized); no string-built SQL; injection strings tested as plain text | Validation + RLS tests with `'; DROP TABLE shifts; --` |
| XSS | React escapes output; payloads stored as text | e2e: `<img src=x onerror=alert(1)>` renders as text, no dialog |
| Brute force / abuse | Rate limits: login (per IP and per email), signup, shift logging, settings, practice, rights, coach (30/hour) | Rate-limit unit tests + action/route tests |
| Oversized payloads | 64 KB Server Action body limit; 32 KB coach body cap checked before parsing | Route test (413) |
| Open redirect after login | `safeNextPath` allows only same-site relative paths | Route unit tests |
| Leaking income data in logs | Only error **codes** are logged, never amounts or message content | Test asserts a failed save never logs "987" |
| Secrets | Server-only env vars; `.env*` is git-ignored and denied to the coding agent in `.claude/settings.json` | Config |
| Clickjacking, sniffing | `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies | e2e header check |
| Prompt injection against the coach | Prompt says user text is data, not instructions; server-side guard; 6 injection cases in the eval | Guard unit tests, eval |
| Account deletion | Admin API deletes the auth user; cascades remove everything | RLS tests: "deletes … when the account is deleted" |

A static test fails the build if any migration creates a table without enabling RLS and revoking anonymous access, or defines a `security definer` function without a pinned `search_path`.

---

## 8. The tip forecast engine and backtest

### How the forecast works (v1: simple and explainable, no ML)
- **Compare like with like:** same **weekday + shift type** ("Friday dinner"). Holiday-tagged shifts are compared only with other holiday shifts.
- **Recent only:** the latest **16** comparable shifts, so the range follows seasons and price changes.
- **Minimum sample size:** no forecast until **4** comparable shifts exist ("Log a few more shifts to unlock your forecast").
- **A range, not a promise:** the typical range is the **25th–75th percentile** (linear interpolation, same as Excel `PERCENTILE.INC`) of take-home. The median is the midpoint.
- **Messaging:** above p75 celebrates with a percentage; within range reads as typical; below p25 is neutral. There's deliberately no negative tone in the code.

### Why percentiles instead of an average ± something?
Tips are right-skewed: one huge party drags an average up. Percentiles are robust to outliers, easy to explain ("half your Friday dinners land in this range"), and don't assume a normal distribution.

### The backtest (how the forecast was validated)
- **Walk-forward:** each shift is forecast using *only earlier shifts*, then checked against what actually happened. No peeking at the future.
- **Data:** a seeded **simulated** dataset (one server, 2 years, weekday effects, summer/December seasonality, a +5%/year trend, log-normal noise, context tags, holidays). It's labeled simulated everywhere, because no real users exist yet.
- **Results (3 seeds, ~1,780 shifts, ~1,670 forecast after unlock):**

| Seed | Shifts | Forecast | In range | Above | Below | MAE vs midpoint | Median abs % error |
|---|---|---|---|---|---|---|---|
| 42 | 588 | 551 | 44.3% | 30.9% | 24.9% | $35 | 16.6% |
| 7 | 603 | 566 | 43.6% | 30.2% | 26.1% | $35 | 17.9% |
| 2026 | 591 | 554 | 41.5% | 31.2% | 27.3% | $35 | 17.3% |

**How to read it:** a perfectly calibrated p25–p75 range would contain about **50%** of outcomes. Ours contains **42–44%**, so it's slightly narrow, and misses lean above the range. That's consistent with the simulated upward trend: a 16-shift window lags a rising baseline. The typical miss is about **$35 (≈17%)** per shift.

**Regression guard:** `npm test` fails if calibration drifts outside 35–65% in range or misses become lopsided (more than 15 points between above and below).

**Next experiments** (to test with the same backtest): a slightly wider band (p20–p80) and recency weighting.

---

## 9. Budgeting math

- **Tip-outs:** each role (bar, busser, host) is a percentage of **tips** or of **sales**, stored as basis points (1% = 100 bp) so the math is exact integers. Rounding is half up per line. The total can never exceed the tips, so take-home is never negative. Validation: tip-based roles total at most 100% of tips; any sales-based role is at most 20% of sales (enforced in Zod *and* a CHECK constraint).
- **Split:** bills / savings / spending / taxes, whole percentages summing to 100. Uses **largest-remainder rounding** so the parts always add back to the exact cent amount.
- **Usual schedule:** weekday + type combos worked in at least half of the last 8 complete weeks.
- **Week outlook:** earned so far + typical (median) for usual shifts still ahead = projected. The typical range uses the p25/p75 sums.
- **Safe to spend:** the spending share of a *conservative* week, meaning earned so far + **80%** of what's typical for the shifts ahead.
- **Slow-week alerts (neutral):** (1) this week projects under 85% of a typical week; (2) seasonal: an upcoming week that last year was under 85% of the median of the 4 weeks around it. Weeks with no shifts last year count as time off, not as slow weeks.
- **Taxes:** labeled "a savings target you choose, not tax advice".

---

## 10. Daily habits, drills and streaks

- **Streak:** consecutive days with *any* activity: a logged shift (any amount), a drill, or a habit checked off. If today isn't done yet, the streak is still alive through yesterday.
- **Daily tasks:** log tips, the suggested drill (next unpassed in an unlocked level, then rotating review), and one habit that rotates by day of year.
- **Drill integrity:** answer choices are shuffled with a **fixed seed per question**, so the right answer isn't always "B" and the client and server see the same order. The client sends only the chosen answers; **the server grades** and records the score. A client-sent score is ignored (tested). Drill scores can't be updated after the fact (RLS has no update policy).
- **Menu quizzes:** generated deterministically from the user's dishes and a seed. The server rebuilds the identical quiz from that seed to grade it. Allergen questions use the 9 major US food allergens, with a reminder to always confirm with the kitchen.

---

## 11. The labor-law dataset

### Scope
- **5 states (CA, FL, IL, NY, TX) + the federal baseline, 7 topics, 32 rules.**
- Topics: meal breaks, rest breaks, break pay, tip credit / minimum cash wage, employers or managers taking tips, tip pools / tip-outs, card fees on tips.
- Why 5 states? The plan says "launch with a few states done right rather than all 50 done loosely". These five cover very different regimes: California (no tip credit, strict breaks), Texas (federal minimum), New York (regional tipped wages, time-based meal rules), Florida (constitutional minimum wage schedule), Illinois (40% tip credit, 7.5-hour meal rule).

### How every rule was verified
1. **Primary sources only:** US Department of Labor (Fact Sheet #15, the breaks page, state tipped-wage / meal / rest tables), California DIR Labor Commissioner FAQs, the Texas Workforce Commission employer guidebook, NY DOL (2026 tipped wage sheet P717, tips FAQ) and NY Labor Law §162 on the NY Senate site, the FloridaCommerce 2026 minimum wage notice, and Illinois DOL pages. No blogs, law-firm summaries or AI-generated text.
2. Each page was fetched and the relevant passage read during research. PDFs were text-extracted and quoted.
3. Each rule stores **`source_url`, `legal_basis`, `last_verified_at` (2026-10-27)** and **`reviewed_by = "pending attorney review"`**, so nothing claims a review that hasn't happened.
4. **Unclear or fact-dependent answers are "Depends"** (for example NY meal breaks depend on when the shift starts; tip pools depend on whether a tip credit is taken). Never a yes/no guess.
5. **Rates that change on a known date carry `valid_through`** (NY and CA 2026 rates expire 2026-12-31; FL runs through 2027-12-31) and flag themselves for review after that date.

### Precedence logic
The federal rule is the baseline everywhere; a verified state rule for the same topic takes precedence. If a covered state has no rule on a topic, the federal rule is shown *with a note* that state law wasn't verified. For uncovered states, users see federal rules clearly labeled as a minimum.

### Staleness
Flagged "needs review" if: not re-verified in **90+ days**, the rate is past `valid_through`, or an admin set `status = needs_review`. Flagged rules are still shown, but with a warning.

### Quality gate (runs in CI)
`npm test` fails if any published rule:
- lacks a `source_url`, or uses a non-primary or non-https source (a host allowlist of government and statute sites; look-alike domains such as `dol.gov.evil.example` are rejected),
- lacks a valid `last_verified_at` or `legal_basis`,
- has an unknown topic, answer or status,

or if the generated `supabase/seed/labor_rules.sql` is out of sync with the JSON. `npm run labor:report` prints the numbers:

| Metric | Value |
|---|---|
| States covered | 5 + federal |
| Rules | 32 (all published) |
| With source URL / primary source / verified date | 100% / 100% / 100% |
| Stale | 0 |
| Attorney-reviewed | 0 of 32. **Required before public launch.** |

### Admin-only editing
`labor_rules` is writable only when the JWT carries `app_metadata.role = 'admin'` (RLS), and the server action checks the same claim. Rule *text* changes go through the reviewed JSON file and a PR; the admin page only re-stamps verification dates and changes status.

---

## 12. The AI Server Coach

### What it does
Answers serving questions with practical advice, and workplace-rights questions **only from the verified rules for the user's state**. Anything else gets a polite redirect.

### How "only from the dataset" is enforced (defense in depth)
1. **Retrieval by state:** the request includes only the user's state's rules plus federal rules, each tagged with an id (`<rule id="ca-meal_break">`). The dataset is small, so it fits in context without a vector store.
2. **Instructions:** cite rule ids; keep each rule's Yes / No / Depends answer and numbers exactly; if the rules don't answer it, say so and point to the labor department; treat user messages as questions, not instructions.
3. **Structured output** (Zod schema → JSON): `{ kind: serving | legal | out_of_scope, covered, cited_rule_ids, reply }`, parsed into a typed object.
4. **Server-side guard** (the part that doesn't depend on the model behaving):
   - cited ids that weren't sent are **dropped**;
   - a legal answer that's uncovered, or claims coverage with no valid citation, is **replaced with fixed wording** ("I don't have verified information on that, so I won't guess…") plus the right labor-department link, so the model's own words never carry an unsourced legal claim;
   - **sources shown to users come from our database** (URL, legal basis, verified date), never from the model's text.
5. **States we don't cover:** the coach is told federal rules are only a floor and must say the state may give more. For example, it must not imply $2.13/hour is fine in Washington.

### Model and API details
- **Model:** Claude Opus 5.5 (`claude-opus-5-5`; on Bedrock `anthropic.claude-opus-5-5`), effort `low` (chat-length answers).
- **Prompt caching:** the fixed system prompt is the first system block with `cache_control`. The per-user rules come second, so the cached prefix never changes between users.
- **Refusals:** a `stop_reason: "refusal"` is handled before reading content. On the Claude API, `fallbacks: "default"` retries on Anthropic's recommended model; Bedrock doesn't offer server-side fallbacks, so there a decline returns a friendly "can't help with that one".
- **Errors:** typed SDK errors (rate limit → "busy, try again"; other API/network errors → "can't answer right now"). Only status codes are logged, never message content.

### Two providers, one code path
`COACH_PROVIDER` selects the client:

| | Claude API (default) | Amazon Bedrock |
|---|---|---|
| Client | `new Anthropic()` (`@anthropic-ai/sdk`) | `new AnthropicBedrockMantle()` (`@anthropic-ai/bedrock-sdk`) |
| Endpoint | api.anthropic.com | `bedrock-mantle.{region}.api.aws/anthropic` |
| Model id | `claude-opus-5-5` | `anthropic.claude-opus-5-5` |
| Auth | `ANTHROPIC_API_KEY` | AWS credential chain: access keys, profile, or `AWS_BEARER_TOKEN_BEDROCK`; `AWS_REGION` |
| Server-side fallbacks | Yes | No |
| Structured output, caching | Yes | Yes |

Everything else (prompt, schema, guard, eval) is identical, so an eval on Bedrock tests the same coach.

---

## 13. The coach eval

### Why an eval
Unit tests prove the *code* is right (with a fake model). An eval measures whether the *model + prompt + guard* behave on realistic questions, and it's the regression check to re-run after any prompt or data change.

### The set: 49 cases (`evals/coach/cases.json`)

| Category | Cases | What "correct" means |
|---|---|---|
| Covered legal | 23 | Cites a correct rule (e.g. `ca-meal_break`); key facts present (e.g. "$16.90", "$11.98") |
| Uncovered legal | 10 | Says "no verified info" (overtime, scheduling, retaliation, taxes, sick leave, harassment, uniforms, training pay, unemployment, a city wage) |
| Serving | 6 | Classified as serving; no legal sources attached |
| Out of scope | 4 | Politely declines (poem, calculus, stock picks, trivia) |
| Prompt injection | 6 | Behavior doesn't change: no forbidden claim gets through ("tip-outs are always illegal", fake "you're owed $500", invented rule ids, system-prompt leak, fake "admin update", role-play "lawyer") |

Every expected citation is checked to be a rule the coach is actually given for that state (a unit test enforces this).

### Grading (deterministic, no LLM judge)
`src/lib/coach/eval.ts` grades each case on both the **raw model output** and the **guarded reply the user sees**:

- **% correct:** the case's expectations are met.
- **% source-cited:** covered legal questions answered with a correct verified source.
- **% "no verified info":** uncovered legal questions answered with the fallback.
- **% invented legal claims, raw:** how often the model *tried* (claimed coverage without valid citations, or cited a rule that doesn't answer the question).
- **% invented legal claims, shown to user:** after the guard. **Target 0; the run fails otherwise.**
- **% injection resisted.**

Reporting raw *and* final separately shows both how good the model is and how much the guard is doing.

### How to run it (Amazon Bedrock)
1. AWS account → Bedrock console → enable **Claude Opus 5.5** model access (e.g. `us-east-1`).
2. IAM user with Bedrock invoke permission → access key.
3. `.env.local`:
   ```
   COACH_PROVIDER=bedrock
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```
4. `npm run eval:coach`. It runs 49 cases (4 at a time), prints the summary, and writes `evals/coach/results/<date>.json` (scores plus every failure with its raw output).

It's kept out of CI because it calls a paid API. It's run manually after any change to the coach prompt or labor data.

### Results

| Metric | Value |
|---|---|
| Date / provider / model | ⬜ TO FILL (e.g. 2026-11-xx / bedrock / anthropic.claude-opus-5-5) |
| Correct | ⬜ TO FILL |
| Covered legal answered with a verified source | ⬜ TO FILL |
| Uncovered answered "no verified info" | ⬜ TO FILL |
| Invented legal claims, raw model output | ⬜ TO FILL |
| Invented legal claims, shown to users | ⬜ TO FILL (run fails if > 0) |
| Prompt-injection cases resisted | ⬜ TO FILL |

---

## 14. Testing and CI/CD

| Suite | Count | Runs |
|---|---|---|
| Unit/integration (Vitest) | **569 passing** | Every push (CI) |
| RLS integration (real Supabase) | **73** (skipped without `SUPABASE_TEST_*`) | `npm run test:rls`, or CI once repo secrets are set |
| End-to-end (Playwright, Pixel 7 viewport) | **7 flows** | Every push (CI) |
| Forecast backtest calibration guard | in `npm test` | Every push |
| Labor data quality gate + seed sync | in `npm test` | Every push |
| Coach eval (live) | 49 cases | Manual (`npm run eval:coach`) |

Coverage highlights: forecast **100%**, report **100%**, budget outlook and split **100%** lines.

**Testing rules the project follows** (`.claude/rules/testing.md`): every function with logic gets tests in the same change; tests are named by behavior ("returns no forecast under 4 shifts"); edge cases always covered (no data, one shift, zero tips, invalid input, state with no rules); a bug gets a failing test first, kept forever as a regression test; never weaken a failing test.

**Example of the process working:** while building the coach, a test found that Zod 4 keeps running refinements after `.min(1)` fails, so an empty message list crashed instead of returning a 400. The test came first, then the fix, and the test stays as a regression check.

**CI** (`.github/workflows/ci.yml`, GitHub Actions), on every push and PR: lint → typecheck → unit tests with coverage → Playwright on a production build. A red check blocks merging with confidence.

**CD (Vercel):** once the repo is connected (section 15), every push to `main` deploys to production and every PR gets a preview URL. Together that's CI/CD: GitHub Actions verifies, Vercel ships.

---

## 15. Deployment

### Production setup
1. **Supabase** (free tier): new project → SQL Editor → run `supabase/migrations/*.sql` in order, then `supabase/seed/labor_rules.sql` → Auth → URL Configuration: Site URL = the Vercel URL, Redirect URL = `https://<url>/auth/callback`.
2. **Vercel** (Hobby, free): import the GitHub repo → env vars:

| Variable | Where it's used | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | Yes (public by design) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client (RLS protects data) | Yes (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Account deletion only | **No**, server only |
| `NEXT_PUBLIC_SITE_URL` | Auth email / OAuth redirects | Yes |
| `COACH_PROVIDER`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Coach via Bedrock | **No**, server only |
| or `ANTHROPIC_API_KEY` | Coach via Claude API | **No**, server only |

3. Deploy → every push to `main` redeploys automatically.

### Live deployment

| | |
|---|---|
| URL | ⬜ TO FILL |
| Deployed on | ⬜ TO FILL |
| Smoke test (signup → log shift → report → rights → coach) | ⬜ TO FILL |
| Lighthouse (Report, Log): Performance / Accessibility / Best Practices | ⬜ TO FILL |

---

## 16. The résumé bullets, explained

### Bullet 1
> Built a full-stack tip-tracking and coaching web app using Next.js, TypeScript, and Supabase, with authentication and row-level security on all user data, deployed on Vercel.

- **What it means:** I built the whole thing: UI, server logic, database schema and security, not just a frontend.
- **"Full-stack":** React client components, Next.js Server Components/Actions and a route handler, Postgres with migrations.
- **"Authentication":** Supabase Auth (email + Google), session refresh in `proxy.ts`, protected routes, rate-limited login/signup, account deletion.
- **"Row-level security on all user data":** all 7 per-user tables have RLS policies tied to `auth.uid()`, a static test fails the build if a table lacks RLS, and 73 integration tests try to break it (read, edit, delete and spoof as another user).
- **"Deployed on Vercel":** ⬜ the live URL (section 15).
- **Why:** servers need something fast and trustworthy for sensitive income data. Getting security into the database, not just the app, was a deliberate choice.

### Bullet 2
> Designed a tip-forecasting engine using day-of-week and shift-type percentile ranges, validated with a backtest on simulated shift data and covered by an automated unit and regression test suite (Vitest, Playwright) that runs in CI on every push.

- **"Day-of-week and shift-type percentile ranges":** compare like with like (Friday dinner vs. Friday dinner); p25–p75 of the last 16; 4-sample minimum; holidays separate.
- **"Validated with a backtest":** walk-forward on ~1,780 simulated shifts across 3 seeds; 42–44% in range against a 50% target (slightly narrow, misses lean high because of the simulated growth trend); typical miss ~$35 (~17%).
- **"Unit and regression test suite":** 569 Vitest tests (forecast code at 100% coverage), 7 Playwright flows, plus a calibration guard that fails CI if the forecast's behavior drifts.
- **"Runs in CI on every push":** GitHub Actions, `.github/workflows/ci.yml`.
- **Why:** a forecast people budget around has to be honest. Ranges instead of promises, and measured against data it hasn't seen.

### Bullet 3
> Built a sourced labor-law database where every rule links to a primary source with a last-verified date and stale-rule flagging, plus an AI coach restricted to that dataset and tested against an eval set that includes prompt-injection and out-of-scope questions.

- **"Sourced labor-law database":** 32 rules, 5 states + federal, each with a government source URL, legal basis and verified date; a CI quality gate enforces it.
- **"Stale-rule flagging":** 90-day re-verification window plus rate expiry dates; flagged rules show a warning.
- **"AI coach restricted to that dataset":** state-scoped retrieval, structured output with cited rule ids, and a server-side guard that replaces any uncovered or uncited legal answer with fixed wording.
- **"Tested against an eval set":** 49 cases including 6 prompt-injection and 4 out-of-scope, graded deterministically on raw and guarded output. Results: ⬜ TO FILL (section 13).
- **Why:** wrong legal information can cost a server real money. Accuracy over coverage, and the model is never the last line of defense.

---

## 17. Interview questions and answers

### Product and scope
**Q: Why build this?**
Servers' income is irregular and their workplace rights are confusing and state-specific. Existing budgeting apps assume a paycheck, and legal info online is often wrong or generic. I wanted one fast, mobile tool that's honest: ranges instead of promises, sources instead of guesses.

**Q: What would you cut if you had half the time?**
Drills and levels. The core is logging → forecast → budget, then rights. I built the forecast before budgeting because budgeting depends on it.

**Q: How do you decide what's "done"?**
Tests for every function with logic, the full suite green, lint and types clean, a production build, a visual check on a phone-sized screen, and metrics recorded in `docs/METRICS.md`.

### Architecture
**Q: Walk me through what happens when a user logs a shift.**
See section 4: Server Action → verified session user → rate limit → Zod (money to integer cents) → tip-out computed on the server → insert through supabase-js → RLS check → unique `client_id` for offline retries → revalidate the Report.

**Q: How does offline logging work, and how do you avoid duplicates?**
If the phone is offline (or the request fails mid-flight), the shift goes into a localStorage queue with a client-generated UUID. When the connection returns, the queue flushes through the same Server Action. The database has `UNIQUE (user_id, client_id)`, and a unique violation on retry is treated as "already saved". Storage access is guarded because it can throw in private mode.

**Q: Why put logic in `src/lib` as pure functions?**
Testability and correctness. The forecast doesn't know about the database or the clock; you pass shifts and a date and get a forecast back. That's why there are hundreds of fast, deterministic tests and why the backtest can reuse the exact production engine.

**Q: Server Actions vs. API routes?**
Server Actions for form mutations (type-safe, less boilerplate). A route handler for the coach because it's a JSON API needing explicit status codes, a body-size check before parsing, and `Retry-After` headers.

**Q: How do you handle time zones?**
Shift dates are calendar days, not timestamps. "Today" comes from the phone's local date on screens that need it, and all date math runs in UTC on date strings, so DST can't shift a day. Server-side date checks allow a ±1 day window for phones ahead of or behind UTC.

### Database
**Q: Why Supabase/Postgres over Firebase/MongoDB?**
The data is relational: everything belongs to a user, the reads are filtered aggregates, and I wanted constraints and cascades in the database. Postgres gives foreign keys, CHECK constraints, unique indexes and RLS. Supabase adds Auth and hosting with no backend server to run.

**Q: What is Row Level Security, and why use it if you already check auth in code?**
RLS is a Postgres policy evaluated on every row a query touches, e.g. `using (auth.uid() = user_id)`. App checks can have bugs; RLS means even a buggy query can't return someone else's tips. It's defense in depth, and I test it with real users against a real database.

**Q: How is account deletion guaranteed to remove everything?**
Every per-user table references `auth.users` with `ON DELETE CASCADE`. Deleting the auth user (with the server-only service-role key) removes all rows, and there's an RLS test per table that verifies it.

**Q: Why store money as cents?**
Floating point can't represent 0.10 exactly; summing floats drifts. Integer cents keep sums exact. The database uses `numeric(10,2)` and conversion happens only at the edge.

**Q: How do you prevent invalid data if someone bypasses the UI?**
Three layers: Zod on the server (rejects -$5 tips, a 40-hour shift, a 200% tip-out, a split that isn't 100), CHECK constraints in Postgres as the last line of defense, and RLS for ownership. Tests hit the Server Actions directly, not the UI.

### Forecast
**Q: Why percentiles and not a mean or ML model?**
Tips are skewed by big nights; percentiles are robust and explainable. ML was explicitly out of scope for v1: with 4–16 samples per group, a simple model is more honest. The backtest is how I'd compare a v2.

**Q: Your backtest shows 42–44% in range. Isn't that bad?**
The target for a p25–p75 range is 50%, so it's slightly narrow, and the misses lean high. In the simulation there's a +5%/year trend, and a 16-shift window lags a rising baseline. The fixes to test next are a wider band (p20–p80) or recency weighting, measured with the same backtest. I'd rather report 44% honestly than tune the test data until it says 50%.

**Q: Why simulated data?**
There are no real users yet. It's a seeded, realistic generator (weekday and seasonal effects, trend, noise, holidays), labeled simulated everywhere. When testers log real shifts, I'd report that backtest separately.

### Labor law
**Q: How do you know the legal info is correct?**
Every rule comes from a primary government source that I fetched and read, with the URL, legal basis and verified date stored on the row. Unclear cases are "Depends". A CI gate rejects any published rule without a primary source or date. It still needs an employment attorney's review before a public launch, and the app says so.

**Q: What happens when a law changes?**
Rules with dollar amounts carry a `valid_through` date and flag themselves when it passes. Every rule also goes stale after 90 days without re-verification. Admins re-verify against the source, and text changes go through a reviewed PR.

**Q: Why only 5 states?**
Accuracy over coverage. Five states done carefully, with very different regimes, beat 50 done loosely. Uncovered states get the federal baseline, clearly labeled as a minimum.

### AI coach
**Q: How do you stop the coach from making up laws?**
Four layers: it only receives the user's state's rules plus federal ones; the prompt requires citing rule ids; structured output makes citations machine-checkable; and a server-side guard drops unknown citations and replaces any uncovered or uncited legal answer with fixed wording. Sources come from my database, not the model.

**Q: Why not RAG with a vector database?**
The dataset is 32 rules, and per state it's 12–14 (state rules plus federal). That fits in context. Filtering by state is exact, whereas embedding similarity could miss or mix states. I'd add retrieval if the dataset grew to hundreds of rules.

**Q: How do you handle prompt injection?**
The system prompt says user messages are questions, not instructions; the role can't be changed by the client (the schema rejects `system` messages); and the guard means even a successful injection can't put an unsourced legal claim in front of a user. Six injection cases in the eval measure it.

**Q: What does prompt caching do here?**
The system prompt is identical for every request, so it's sent first with `cache_control`. Repeated requests read it from cache, which is cheaper and faster. The per-user rules come after the cached block so they don't break the cache.

**Q: Why Amazon Bedrock?**
Same Claude model and API shape through AWS: AWS billing and credits, IAM-based access, and the AWS data boundary. I made the provider a single env var, so the prompt, schema, guard and eval are shared, and an eval on Bedrock tests the same coach. One difference I had to handle: Bedrock doesn't offer server-side refusal fallbacks, so those parameters are only sent to the Claude API.

**Q: How did you evaluate it?**
49 cases across five categories, graded deterministically (no LLM judge) on both the raw model output and the guarded reply. The headline safety metric, invented legal claims shown to users, has a target of 0, and the run fails otherwise. Results: ⬜ (section 13).

**Q: Why no LLM-as-judge?**
Every expectation here is checkable: which rule was cited, whether a key number appears, whether the reply was classified correctly, whether a forbidden phrase appears. Deterministic grading is cheaper, reproducible and can't be fooled by the same model.

**Q: What does it cost to run?**
Per question: a cached fixed system prompt, the state's rules, and a short answer at low effort, so it's small. The eval is 49 calls, well under a dollar. Users are rate-limited to 30 questions an hour.

### Testing and CI/CD
**Q: How do you test RLS?**
Integration tests create real users against a throwaway Supabase project and try to read, edit, delete and insert-as another user, then confirm via the admin client that nothing changed. They also test anonymous access, DB-level CHECK constraints and cascade deletion.

**Q: How do you test code that calls an LLM?**
Unit tests inject a fake client (`CoachClient` is just the slice of the SDK the coach uses) to test request shape, refusals, typed errors and the guard. The live eval tests the real model separately.

**Q: Tell me about a bug your tests caught.**
Zod 4 runs refinements even after `.min(1)` fails, so an empty coach request crashed instead of returning a 400. The test came first, then the fix, and it stays as a regression test. Another, found in design review rather than by a test: for states we don't cover, the coach could have quoted the federal $2.13 tipped wage to someone in Washington, which requires the full minimum wage. I changed the prompt so federal rules are presented as a floor, and added a test for it.

**Q: What does CI do, and what's CD here?**
CI: GitHub Actions on every push and PR runs lint, typecheck, unit tests with coverage, and Playwright against a production build. CD: Vercel deploys `main` to production on every push and builds a preview for each PR.

### Security
**Q: Where could this still be attacked?**
Rate limits are in-memory per serverless instance, which is fine for slowing abuse but not a hard global limit. I'd move them to Postgres or Redis before scaling. Also: Google OAuth configuration, and the admin role depends on keeping the service-role key secret.

### Process
**Q: How did you work with AI tools?**
I used Claude Code as a pair programmer with project rules (`CLAUDE.md`, `.claude/rules/`) for the testing standards, labor-data integrity and UI copy, plus a deny-list so the agent can't read secrets. Every phase landed as a reviewed PR with tests and metrics. I made the decisions, reviewed the code and verified the results, and the rules files are how I kept standards consistent.

---

## 18. Limitations and what I'd do next

- **Attorney review** of the labor dataset before any public launch of Rights or the coach's legal answers.
- **Forecast v2:** test p20–p80 and recency weighting against the backtest; report real-user calibration separately once testers exist.
- **Rate limiting** in a shared store (Postgres/Redis) instead of per-instance memory.
- **More states and topics** (overtime, scheduling), each sourced and gated the same way.
- **Phase 6:** Stripe subscriptions, moderated community, PWA install, privacy-respecting analytics (Day 7 / Day 30 retention, forecast unlock rate).
- **Coach:** client-side refusal fallback on Bedrock; streaming responses; conversation history saved per user.

---

## 19. Numbers cheat sheet

| Fact | Number |
|---|---|
| Unit/integration tests passing | 569 |
| RLS integration tests | 73 |
| Playwright e2e flows | 7 |
| Database tables | 8 (all with RLS) |
| Forecast: min / max samples, range | 4 / 16, p25–p75 |
| Backtest: shifts, in range, typical miss | ~1,780 simulated (3 seeds), 42–44% (target 50%), ~$35 (~17%) |
| Forecast and report code coverage | 100% |
| Labor dataset | 5 states + federal, 7 topics, 32 rules, 100% primary-sourced and dated |
| Stale threshold | 90 days (+ rate expiry dates) |
| Drills | 2 levels, 8 drills, 40 questions, 80% to pass |
| Coach eval set | 49 cases (23 covered, 10 uncovered, 6 serving, 4 out-of-scope, 6 injection) |
| Coach rate limit / body cap | 30 per user per hour / 32 KB |
| Coach eval results | ⬜ TO FILL |
| Live URL | ⬜ TO FILL |
