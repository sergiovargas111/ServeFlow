-- Profiles: one row per auth user, created automatically on signup.
-- Users can read and update only their own row (RLS). Deleting the auth
-- user cascades here, which is how account deletion removes data.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
    constraint profiles_username_not_reserved check (
      username not in ('admin', 'administrator', 'root', 'support', 'help', 'serveflow',
                       'staff', 'moderator', 'mod', 'system', 'null', 'undefined', 'me')
    ),
  state text constraint profiles_state_format check (state is null or state ~ '^[A-Z]{2}$'),
  city text constraint profiles_city_length check (city is null or char_length(city) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- No anonymous access at all; signed-in users only see themselves.
revoke all on public.profiles from anon;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Inserts happen only through the signup trigger below; deletes only via
-- auth.users cascade. No insert/delete policies on purpose.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile when an auth user is created. The username comes from
-- signup metadata (validated by the server action first). OAuth signups and
-- anything invalid get a generated placeholder the user can change later.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := lower(trim(new.raw_user_meta_data ->> 'username'));
  fallback text := 'server_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if requested is null or requested !~ '^[a-z0-9_]{3,20}$' then
    requested := fallback;
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, requested);
  exception when unique_violation or check_violation then
    insert into public.profiles (id, username) values (new.id, fallback);
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the signup form say "username taken" before creating the account.
-- Returns only a boolean, never profile data.
create function public.is_username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where username = lower(trim(name)));
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
