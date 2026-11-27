-- Expose the webhook secret only to the Supabase service role.
create or replace function public.get_nexora_call_push_secret()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;
  return (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'nexora_call_push_webhook_secret'
    limit 1
  );
end;
$$;

revoke all on function public.get_nexora_call_push_secret() from public, anon, authenticated;
grant execute on function public.get_nexora_call_push_secret() to service_role;
