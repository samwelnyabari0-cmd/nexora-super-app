drop function if exists public.search_academy_educators(text, text, integer, integer);
drop view if exists public.academy_educator_directory;

create or replace function private.search_academy_educators_core(
  p_query text,
  p_skill text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  display_name text,
  handle text,
  bio text,
  avatar_url text,
  account_type text,
  profile_category text,
  education_skills text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
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
    p.bio,
    p.avatar_url,
    p.account_type,
    p.profile_category,
    p.education_skills
  from public.profiles as p
  where p.account_type in ('creator', 'business')
    and p.profile_category = 'education'
    and p.discoverable is true
    and p.private_profile is false
    and (
      nullif(btrim(p_query), '') is null
      or concat_ws(' ', p.display_name, p.handle, p.bio) ilike '%' || btrim(p_query) || '%'
      or exists (
        select 1 from unnest(p.education_skills) as skill(value)
        where skill.value ilike '%' || btrim(p_query) || '%'
      )
    )
    and (
      nullif(btrim(p_skill), '') is null
      or exists (
        select 1 from unnest(p.education_skills) as skill(value)
        where lower(skill.value) = lower(btrim(p_skill))
      )
    )
  order by lower(coalesce(p.display_name, p.handle, ''))
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 1000000));
end;
$function$;

revoke all on function private.search_academy_educators_core(text, text, integer, integer) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.search_academy_educators_core(text, text, integer, integer) to authenticated;

create or replace function public.search_academy_educators(
  p_query text default null,
  p_skill text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  handle text,
  bio text,
  avatar_url text,
  account_type text,
  profile_category text,
  education_skills text[]
)
language sql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
  select * from private.search_academy_educators_core(p_query, p_skill, p_limit, p_offset);
$function$;

revoke all on function public.search_academy_educators(text, text, integer, integer) from public, anon;
grant execute on function public.search_academy_educators(text, text, integer, integer) to authenticated;
