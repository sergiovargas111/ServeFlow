-- Budget settings: one row per user. Tip-outs owed to support staff (each a %
-- of tips or of sales) and how take-home is split across bills, savings,
-- spending and taxes. Users only ever touch their own row (RLS); deleting the
-- account removes it (cascade).

create table public.budget_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bar_pct numeric(5, 2) not null default 0,
  bar_basis text not null default 'tips',
  busser_pct numeric(5, 2) not null default 0,
  busser_basis text not null default 'tips',
  host_pct numeric(5, 2) not null default 0,
  host_basis text not null default 'tips',
  split_bills smallint not null default 50,
  split_savings smallint not null default 10,
  split_spending smallint not null default 25,
  split_taxes smallint not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_basis_allowed check (
    bar_basis in ('tips', 'sales') and busser_basis in ('tips', 'sales') and host_basis in ('tips', 'sales')
  ),
  -- % of tips: each 0–100 and all tip-based roles together at most 100.
  -- % of sales: each 0–20 (real tip-outs are a few percent of sales).
  constraint budget_tip_out_range check (
    bar_pct >= 0 and busser_pct >= 0 and host_pct >= 0
    and (bar_basis = 'tips' or bar_pct <= 20)
    and (busser_basis = 'tips' or busser_pct <= 20)
    and (host_basis = 'tips' or host_pct <= 20)
    and (case when bar_basis = 'tips' then bar_pct else 0 end
       + case when busser_basis = 'tips' then busser_pct else 0 end
       + case when host_basis = 'tips' then host_pct else 0 end) <= 100
  ),
  constraint budget_split_range check (
    split_bills between 0 and 100 and split_savings between 0 and 100
    and split_spending between 0 and 100 and split_taxes between 0 and 100
  ),
  constraint budget_split_total check (split_bills + split_savings + split_spending + split_taxes = 100)
);

alter table public.budget_settings enable row level security;

revoke all on public.budget_settings from anon;

create policy "budget_settings: read own" on public.budget_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "budget_settings: insert own" on public.budget_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budget_settings: update own" on public.budget_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budget_settings: delete own" on public.budget_settings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger budget_settings_set_updated_at
  before update on public.budget_settings
  for each row execute function public.set_updated_at();

-- Sales per shift, needed only for tip-outs figured as a % of sales.
alter table public.shifts
  add column sales numeric(10, 2)
    constraint shifts_sales_range check (sales is null or sales between 0 and 100000);
