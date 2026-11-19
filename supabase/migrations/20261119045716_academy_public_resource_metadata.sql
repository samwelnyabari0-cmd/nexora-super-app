create or replace function private.get_academy_public_resource_metadata_core(
  p_educator_id uuid default null,
  p_resource_ids uuid[] default null
)
returns table (
  id uuid,
  course_id uuid,
  resource_name text,
  file_type text,
  access_tier text
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
    r.id,
    r.course_id,
    r.resource_name,
    r.file_type,
    r.access_tier
  from public.edu_resources r
  join public.edu_courses c on c.id = r.course_id
  join public.profiles p on p.id = c.instructor_id
  where r.access_tier = 'public'
    and c.is_published is true
    and p.account_type in ('creator', 'business')
    and p.profile_category = 'education'
    and p.discoverable is true
    and p.private_profile is false
    and (p_educator_id is null or c.instructor_id = p_educator_id)
    and (p_resource_ids is null or r.id = any(p_resource_ids))
  order by r.resource_name;
end;
$function$;

revoke all on function private.get_academy_public_resource_metadata_core(uuid, uuid[]) from public, anon;
grant execute on function private.get_academy_public_resource_metadata_core(uuid, uuid[]) to authenticated;

create or replace function public.get_academy_public_resource_metadata(
  p_educator_id uuid default null,
  p_resource_ids uuid[] default null
)
returns table (
  id uuid,
  course_id uuid,
  resource_name text,
  file_type text,
  access_tier text
)
language sql
stable
set search_path = pg_catalog, public, private, pg_temp
as $function$
  select * from private.get_academy_public_resource_metadata_core(p_educator_id, p_resource_ids);
$function$;

revoke all on function public.get_academy_public_resource_metadata(uuid, uuid[]) from public, anon;
grant execute on function public.get_academy_public_resource_metadata(uuid, uuid[]) to authenticated;
