-- Daily habits and practice drills. Drill content lives in code
-- (src/lib/learn/content.ts); these tables only hold each user's own
-- activity. Streaks and levels are computed from them, not stored.
-- Every table: RLS, own rows only, removed with the account (cascade).

-- One row per finished drill. The server grades answers; clients never send a score.
create table public.drill_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  drill_id text not null constraint drill_attempts_drill_id_format check (drill_id ~ '^(l[1-9]-[a-z-]{1,40}|menu)$'),
  score smallint not null,
  total smallint not null,
  completed_on date not null constraint drill_attempts_date_floor check (completed_on >= date '2026-01-01'),
  created_at timestamptz not null default now(),
  constraint drill_attempts_score_range check (total between 1 and 50 and score between 0 and total)
);

create index drill_attempts_user_date_idx on public.drill_attempts (user_id, completed_on desc);

alter table public.drill_attempts enable row level security;

revoke all on public.drill_attempts from anon;

create policy "drill_attempts: read own" on public.drill_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "drill_attempts: insert own" on public.drill_attempts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Attempts are a record of practice: no updates. Users may delete their own.
create policy "drill_attempts: delete own" on public.drill_attempts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Daily habits checked off by hand ("memorize 3 menu items"). Logging a shift
-- and finishing a drill count automatically and aren't stored here.
create table public.task_completions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id text not null
    constraint task_completions_task_id check (task_id in ('memorize_menu', 'practice_greeting', 'review_specials', 'learn_pairing', 'plan_section')),
  completed_on date not null constraint task_completions_date_floor check (completed_on >= date '2026-01-01'),
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, completed_on)
);

alter table public.task_completions enable row level security;

revoke all on public.task_completions from anon;

create policy "task_completions: read own" on public.task_completions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "task_completions: insert own" on public.task_completions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "task_completions: delete own" on public.task_completions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The user's own menu, for menu-quiz drills.
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null constraint menu_items_name_length check (char_length(trim(name)) between 1 and 80),
  description text not null default ''
    constraint menu_items_description_length check (char_length(description) <= 200),
  allergens text[] not null default '{}'
    constraint menu_items_allergens check (
      allergens <@ array['milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soy', 'sesame']::text[]
    ),
  created_at timestamptz not null default now()
);

create index menu_items_user_idx on public.menu_items (user_id);

alter table public.menu_items enable row level security;

revoke all on public.menu_items from anon;

create policy "menu_items: read own" on public.menu_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "menu_items: insert own" on public.menu_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "menu_items: update own" on public.menu_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "menu_items: delete own" on public.menu_items
  for delete to authenticated
  using ((select auth.uid()) = user_id);
