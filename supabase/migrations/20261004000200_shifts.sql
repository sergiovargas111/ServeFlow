-- Shifts: one row per logged shift. The core data behind the Tip Report and
-- forecast. Users can only ever touch their own rows (RLS), and deleting the
-- account removes them (cascade). Amounts are dollars with cents.

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shift_date date not null constraint shifts_date_floor check (shift_date >= date '2000-01-01'),
  shift_type text not null constraint shifts_type check (shift_type in ('lunch', 'dinner', 'double')),
  hours numeric(4, 2) constraint shifts_hours_range check (hours is null or (hours > 0 and hours <= 16)),
  tables_count smallint constraint shifts_tables_range check (tables_count is null or tables_count between 0 and 100),
  gross_tips numeric(10, 2) not null constraint shifts_gross_range check (gross_tips between 0 and 10000),
  cash_tips numeric(10, 2) constraint shifts_cash_range check (cash_tips is null or cash_tips between 0 and 10000),
  card_tips numeric(10, 2) constraint shifts_card_range check (card_tips is null or card_tips between 0 and 10000),
  tip_out numeric(10, 2) not null default 0
    constraint shifts_tip_out_range check (tip_out >= 0 and tip_out <= gross_tips),
  tags text[] not null default '{}'
    constraint shifts_tags_allowed check (
      tags <@ array['rainy', 'slow_section', 'holiday', 'short_staffed', 'event_nearby']::text[]
    ),
  notes text constraint shifts_notes_length check (notes is null or char_length(notes) <= 500),
  -- Set by the phone when a shift is logged offline, so a retried sync can't
  -- create a duplicate.
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_client_id_unique unique (user_id, client_id)
);

create index shifts_user_date_idx on public.shifts (user_id, shift_date desc);

alter table public.shifts enable row level security;

revoke all on public.shifts from anon;

create policy "shifts: read own" on public.shifts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "shifts: insert own" on public.shifts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "shifts: update own" on public.shifts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "shifts: delete own" on public.shifts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger shifts_set_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();
