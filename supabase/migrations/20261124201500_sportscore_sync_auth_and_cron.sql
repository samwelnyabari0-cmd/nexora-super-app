-- Securely authenticate scheduled SportScore syncs and enable the scheduler.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.verify_sportscore_sync_secret(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'sportscore_sync_secret'
      and decrypted_secret = p_token
  );
$$;

revoke all on function public.verify_sportscore_sync_secret(text) from public, anon, authenticated;
grant execute on function public.verify_sportscore_sync_secret(text) to service_role;
