create or replace function public.get_discoverable_profiles(
  p_query text default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  display_name text,
  handle text,
  avatar_url text,
  account_type text,
  private_profile boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.account_type,
    coalesce(p.private_profile, false)
  from public.profiles p
  where p.id <> auth.uid()
    and p.discoverable is true
    and nullif(btrim(p.handle), '') is not null
    and (
      nullif(btrim(p_query), '') is null
      or concat_ws(' ', p.display_name, p.handle) ilike '%' || btrim(p_query) || '%'
    )
  order by lower(coalesce(p.display_name, p.handle))
  limit greatest(1, least(coalesce(p_limit, 24), 60));
end;
$function$;

revoke all on function public.get_discoverable_profiles(text, integer) from public, anon;
grant execute on function public.get_discoverable_profiles(text, integer) to authenticated;