-- Secure per-account browser push subscriptions for background call alerts.
alter table public.push_subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_read_self on public.push_subscriptions;
create policy push_subscriptions_read_self on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
create policy push_subscriptions_insert_self on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_self on public.push_subscriptions;
create policy push_subscriptions_update_self on public.push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
