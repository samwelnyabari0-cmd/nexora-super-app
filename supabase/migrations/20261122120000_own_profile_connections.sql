-- Return the signed-in owner's followers/following with their public identity fields.
-- SECURITY DEFINER is required because the profile and follows tables have restrictive RLS.
create or replace function public.get_my_profile_connections(p_connection_type text)
returns table (
  id uuid,
  display_name text,
  handle text,
  avatar_url text
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

  if p_connection_type is null or p_connection_type not in ('followers', 'following') then
    raise exception 'Invalid connection type' using errcode = '22023';
  end if;

  if p_connection_type = 'followers' then
    return query
    select p.id, p.display_name, p.handle, p.avatar_url
    from public.follows f
    join public.profiles p on p.id = f.follower_id
    where f.following_id = auth.uid()
    order by f.created_at desc;
  else
    return query
    select p.id, p.display_name, p.handle, p.avatar_url
    from public.follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = auth.uid()
    order by f.created_at desc;
  end if;
end;
$function$;

revoke all on function public.get_my_profile_connections(text) from public, anon;
grant execute on function public.get_my_profile_connections(text) to authenticated;
