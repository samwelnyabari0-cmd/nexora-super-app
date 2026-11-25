create or replace function public.is_arena_content_sync_authorized(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    candidate is not null
    and length(candidate) >= 24
    and candidate = (
      select ds.decrypted_secret
      from vault.decrypted_secrets ds
      where ds.name = 'arena_football_sync_secret'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.is_arena_content_sync_authorized(text) from public, anon, authenticated;
grant execute on function public.is_arena_content_sync_authorized(text) to service_role;
