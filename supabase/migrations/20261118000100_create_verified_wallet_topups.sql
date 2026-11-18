-- Persist only server-verified wallet top-ups in the wallet ledger.
-- Authenticated users may read their own entries; only server-side service_role
-- code can insert or change ledger records after Paystack verification.

create table if not exists public.wallet_txns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  amount numeric(12,2) not null check (amount > 0),
  label text not null,
  note text,
  gateway_reference text,
  currency varchar(3) not null default 'KES',
  payment_channel text not null default 'Paystack',
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed', 'refunded')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_txns_gateway_reference_unique
  on public.wallet_txns (gateway_reference)
  where gateway_reference is not null;

create index if not exists wallet_txns_user_created_idx
  on public.wallet_txns (user_id, created_at desc);

alter table public.wallet_txns enable row level security;

drop policy if exists wallet_txns_select_own on public.wallet_txns;
create policy wallet_txns_select_own
  on public.wallet_txns
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.wallet_txns from anon, authenticated;
grant select on table public.wallet_txns to authenticated;
grant all on table public.wallet_txns to service_role;
