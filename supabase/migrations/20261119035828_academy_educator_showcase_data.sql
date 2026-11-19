create or replace function private.get_academy_educator_core(p_educator_id uuid)
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
  select p.id, p.display_name, p.handle, p.bio, p.avatar_url,
         p.account_type, p.profile_category, p.education_skills
  from public.profiles p
  where p.id = p_educator_id
    and p.account_type in ('creator', 'business')
    and p.profile_category = 'education'
    and p.discoverable is true
    and p.private_profile is false;
end;
$function$;

revoke all on function private.get_academy_educator_core(uuid) from public, anon;
grant execute on function private.get_academy_educator_core(uuid) to authenticated;

create or replace function public.get_academy_educator(p_educator_id uuid)
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
  select * from private.get_academy_educator_core(p_educator_id);
$function$;

revoke all on function public.get_academy_educator(uuid) from public, anon;
grant execute on function public.get_academy_educator(uuid) to authenticated;

create or replace function private.get_academy_educator_stats_core(p_educator_id uuid)
returns table (
  total_courses bigint,
  total_lessons bigint,
  total_students bigint
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

  if not exists (
    select 1 from public.profiles p
    where p.id = p_educator_id
      and p.account_type in ('creator', 'business')
      and p.profile_category = 'education'
      and p.discoverable is true
      and p.private_profile is false
  ) then
    return;
  end if;

  return query
  with published_courses as (
    select c.id
    from public.edu_courses c
    where c.instructor_id = p_educator_id
      and c.is_published is true
  )
  select
    (select count(*) from published_courses),
    (select count(*) from public.edu_lessons l join published_courses c on c.id = l.course_id),
    (select count(distinct e.student_id)
     from public.edu_enrollments e
     join published_courses c on c.id = e.course_id
     where e.status = 'active');
end;
$function$;

revoke all on function private.get_academy_educator_stats_core(uuid) from public, anon;
grant execute on function private.get_academy_educator_stats_core(uuid) to authenticated;

create or replace function public.get_academy_educator_stats(p_educator_id uuid)
returns table (
  total_courses bigint,
  total_lessons bigint,
  total_students bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
  select * from private.get_academy_educator_stats_core(p_educator_id);
$function$;

revoke all on function public.get_academy_educator_stats(uuid) from public, anon;
grant execute on function public.get_academy_educator_stats(uuid) to authenticated;
