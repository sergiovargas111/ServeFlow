# Metrics

Real, reproducible numbers only. Every entry says how it was measured and whether it comes from **real users** or **simulated** data. Update at the end of each phase.

## Phase 1: tip forecast (2026-10-04)

### Forecast backtest (SIMULATED data)

How: `npm run backtest`. Walk-forward: each shift is forecast using only shifts from earlier days, then we check whether the real take-home landed in the predicted typical range (p25–p75). Dataset: `generateSyntheticShifts()`, one simulated server over 2 years (Oct 2024–Sep 2026) with weekday effects, summer/December seasonality, a +5%/year trend, log-normal noise, context tags (rain, slow section, events), holidays and ~3% tip-out. Three seeds.

| Seed | Shifts | Forecast (after unlock) | In range | Above | Below | MAE vs midpoint | Median abs % error |
|---|---|---|---|---|---|---|---|
| 42 | 588 | 551 | 44.3% | 30.9% | 24.9% | $35 | 16.6% |
| 7 | 603 | 566 | 43.6% | 30.2% | 26.1% | $35 | 17.9% |
| 2026 | 591 | 554 | 41.5% | 31.2% | 27.3% | $35 | 17.3% |

By shift type (seed 42): lunch 44.5% in range (MAE $15), dinner 43.1% ($38), double 50% ($55).
By sample size (seed 42): 4–7 shifts 37.5% (n=32), 8–11 60% (n=30), 12–16 43.8% (n=489). The small buckets are too small to read much into.

What it means:
- A perfectly calibrated p25–p75 range would contain ~50% of outcomes. Ours contains **~42–44%**, so the range is a little narrow.
- Misses lean **above** the range (~31% vs ~26% below). This is consistent with the simulated upward trend and right-skewed big nights; a 16-shift window lags a rising baseline.
- The typical miss is about **$35** (17% of the midpoint) per shift.
- Possible v2 tweaks to evaluate with this same backtest: a slightly wider band (e.g. p20–p80), recency weighting. Not done yet.

A regression guard in `npm test` fails CI if calibration leaves 35–65% in range or misses become lopsided (>15 points).

No real-user data yet. When early testers log shifts, report their backtest separately here.

### Tests (as of this commit)

| | Count |
|---|---|
| Unit/integration tests passing (`npm test`) | 280 |
| Forecast tests (`src/lib/forecast`) | 42 |
| RLS integration tests (run with `SUPABASE_TEST_*`, skipped in plain `npm test`) | 29 |
| Playwright e2e flows (`npm run test:e2e`) | 6 |

Coverage (`npm run test:coverage`, lines): forecast **100%**, report **100%**, security 96%, all `src/lib` 84.7%. The uncovered parts are thin Supabase client wrappers, exercised by the RLS and e2e suites instead.

## Phase 2: budgeting (2026-10-27)

What shipped: tip-out settings (bar / busser / host, each a % of tips or of sales), automatic tip-out on blank entries (computed on the server), exact-cent split into bills / savings / spending / taxes, "safe to spend this week" (spending share of earned-so-far + 80% of typical for the usual shifts still ahead), typical-month projection with split, and neutral slow-week alerts (this week's pace, and weeks that were slow the same time last year).

| | Count |
|---|---|
| Unit/integration tests passing (`npm test`) | 368 |
| Budget tests (`src/lib/budget`, `src/lib/validation/budget.ts`, settings action) | 73 (+5 auto tip-out tests in the log action) |
| RLS integration tests (skipped without `SUPABASE_TEST_*`) | 43 |
| Playwright e2e flows | 6 |
| Database tables | 3 (`profiles`, `shifts`, `budget_settings`) |

Coverage (lines): budget logic 100% for `outlook.ts` and `split.ts`; `src/lib/budget` 95.8% overall (the uncovered file is the thin Supabase query wrapper).

Not measured: whether "safe to spend" matches real spending. That needs real users.

## Phase 3: daily habits, streaks, levels, drills (2026-10-27)

What shipped: Daily tab (streak + 3 tasks a day: log tips, a drill, a rotating habit; any logged shift counts toward the streak, slow nights included), Learn tab with Level 1 (Basics) and Level 2 (Upselling), 8 drills / 40 questions, graded on the server, Level 2 unlocking after all Level 1 drills are passed at 80%+, and menu quizzes generated from the user's own dishes (ingredients and the 9 major US allergens). Levels 3 and 4 are shown as coming later.

| | Count |
|---|---|
| Unit/integration tests passing (`npm test`) | 441 |
| Learn + daily tests (`src/lib/learn`, `src/lib/daily`, actions) | 67 |
| RLS integration tests (skipped without `SUPABASE_TEST_*`) | 61 |
| Drill content | 8 drills, 40 questions |
| Database tables | 6 (`profiles`, `shifts`, `budget_settings`, `drill_attempts`, `task_completions`, `menu_items`) |

Not measured yet: Day 7 / Day 30 retention and average streak length. Those need real users (Phase 6 analytics).

## Phase 4: Know Your Rights (2026-10-28)

What shipped: a sourced labor-law dataset (`labor_rules`, admin-only editing via RLS + a server check), a Yes / No / Depends checklist for 7 questions (meal breaks, rest breaks, break pay, tip credit, managers taking tips, tip pools, card fees), state rules layered over the federal baseline, stale-rule flagging (90+ days unverified, or a dollar rate past its `valid_through` date), the disclaimer, a link to the state labor department, and a private break log.

Data quality (`npm run labor:report`, dataset verified 2026-10-27 against primary sources):

| | Value |
|---|---|
| States covered | 5 (CA, FL, IL, NY, TX) + federal baseline |
| Rules | 32 (32 published) |
| With a source URL / primary government source / verified date | 100% / 100% / 100% |
| Stale (90+ days or expired rate) | 0 |
| Attorney-reviewed | **0 of 32** (required before public launch) |
| Labor + rights tests | 76 (`src/lib/labor`, rights actions, seed sync) |
| Unit/integration tests passing (`npm test`) | 523 |
| RLS integration tests (skipped without `SUPABASE_TEST_*`) | 73 |
| Database tables | 8 (adds `labor_rules`, `break_logs`) |

Sources used: US DOL (Fact Sheet #15, breaks page, state tipped-wage / meal / rest tables), CA DIR Labor Commissioner FAQs, TWC Texas Guidebook for Employers, NY DOL (P717 2026 tipped wage sheet, tips FAQ) and NY Labor Law section 162, FloridaCommerce 2026 minimum wage notice, Illinois DOL (minimum wage FAQ, ODRISA page, tips press release). Two rules carry rates that change on a known date (NY 2026 tipped wage and CA 2026 minimum wage expire 2026-12-31; FL through 2027-12-31) and will flag themselves for review.

### Not measured yet

- **Time to log a shift** (target under 15 s, one-handed): needs a configured Supabase project and a timed run on a phone. The form is built for it (autofocused amount, pre-filled date and shift type, one tap to save).
- **Lighthouse** scores for the main screens: to run after the first Vercel deploy.
- Product analytics (signups, retention, forecast unlock rate): Phase 6.
