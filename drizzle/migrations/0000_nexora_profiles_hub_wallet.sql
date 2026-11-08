create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  handle text,
  avatar_url text,
  modules jsonb not null default '[]'::jsonb,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hub_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.wallet_txns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('in','out')),
  amount numeric(12,2) not null check (amount > 0),
  label text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  cycle text not null check (cycle in ('weekly','monthly','yearly')),
  start_date date not null default current_date,
  next_due date not null default current_date,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, update, delete on public.hub_state to authenticated;
grant all on public.hub_state to service_role;
grant select, insert, update, delete on public.wallet_txns to authenticated;
grant all on public.wallet_txns to service_role;
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

alter table public.profiles enable row level security;
alter table public.hub_state enable row level security;
alter table public.wallet_txns enable row level security;
alter table public.expenses enable row level security;

create policy "profiles_owner_all" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "hub_state_owner_all" on public.hub_state
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallet_txns_owner_all" on public.wallet_txns
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses_owner_all" on public.expenses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger hub_state_touch before update on public.hub_state
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'member'), '@', 1)),
    'pulse' || substr(replace(new.id::text, '-', ''), 1, 6)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();