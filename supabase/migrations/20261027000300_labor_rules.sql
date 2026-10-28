-- Know Your Rights. labor_rules holds the verified, sourced legal dataset:
-- readable by signed-in users, editable only by admins (app_metadata.role =
-- 'admin', which only the service role can set). break_logs is each user's
-- private record of missed or short breaks.

create table public.labor_rules (
  id text primary key constraint labor_rules_id_format check (id ~ '^[a-z]{2}-[a-z_]+$'),
  jurisdiction text not null constraint labor_rules_jurisdiction_format check (jurisdiction ~ '^[A-Z]{2}$'),
  topic text not null
    constraint labor_rules_topic check (
      topic in ('meal_break', 'rest_break', 'break_pay', 'tip_credit', 'manager_tips', 'tip_pool', 'card_fees')
    ),
  answer text not null constraint labor_rules_answer check (answer in ('yes', 'no', 'depends')),
  plain_english text not null constraint labor_rules_plain_english_length check (char_length(plain_english) between 20 and 1200),
  legal_basis text not null constraint labor_rules_legal_basis_length check (char_length(legal_basis) between 5 and 300),
  -- Every rule needs a primary source over https and a verification date.
  source_url text not null constraint labor_rules_source_https check (source_url ~ '^https://'),
  last_verified_at date not null,
  -- Rules with dollar amounts expire when the rate changes; the app flags them after this date.
  valid_through date,
  reviewed_by text not null constraint labor_rules_reviewed_by_length check (char_length(reviewed_by) between 1 and 120),
  status text not null default 'draft' constraint labor_rules_status check (status in ('draft', 'published', 'needs_review', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labor_rules_one_per_topic unique (jurisdiction, topic)
);

alter table public.labor_rules enable row level security;

revoke all on public.labor_rules from anon;

-- Admin = app_metadata.role 'admin' in the JWT. app_metadata can only be set
-- with the service role, so users can't make themselves admins.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "labor_rules: signed-in users read visible rules" on public.labor_rules
  for select to authenticated
  using (status in ('published', 'needs_review') or (select public.is_admin()));

create policy "labor_rules: admins insert" on public.labor_rules
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "labor_rules: admins update" on public.labor_rules
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "labor_rules: admins delete" on public.labor_rules
  for delete to authenticated
  using ((select public.is_admin()));

create trigger labor_rules_set_updated_at
  before update on public.labor_rules
  for each row execute function public.set_updated_at();

create table public.break_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shift_date date not null constraint break_logs_date_floor check (shift_date >= date '2000-01-01'),
  break_type text not null constraint break_logs_type check (break_type in ('meal', 'rest')),
  outcome text not null constraint break_logs_outcome check (outcome in ('taken', 'short', 'interrupted', 'missed')),
  minutes smallint constraint break_logs_minutes_range check (minutes is null or minutes between 0 and 120),
  paid text not null default 'unsure' constraint break_logs_paid check (paid in ('paid', 'unpaid', 'unsure')),
  notes text constraint break_logs_notes_length check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index break_logs_user_date_idx on public.break_logs (user_id, shift_date desc);

alter table public.break_logs enable row level security;

revoke all on public.break_logs from anon;

create policy "break_logs: read own" on public.break_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "break_logs: insert own" on public.break_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "break_logs: delete own" on public.break_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);
