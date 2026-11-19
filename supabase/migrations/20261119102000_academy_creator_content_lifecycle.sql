-- Independent Creator Academy publication lifecycle and protected deletion.
-- Existing published content receives a fresh 30-day safety window at migration time.

alter table public.edu_courses
  add column publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published', 'archived')),
  add column published_at timestamptz,
  add column last_published_at timestamptz,
  add column skill_tags text[] not null default '{}'::text[];

alter table public.edu_lessons
  add column publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published', 'archived')),
  add column published_at timestamptz,
  add column last_published_at timestamptz;

alter table public.edu_resources
  add column publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published', 'archived')),
  add column published_at timestamptz,
  add column last_published_at timestamptz;

-- Do not infer an old publication date from created_at. Protect all existing
-- live material for 30 days from this migration instead.
update public.edu_courses
set publication_status = case when is_published then 'published' else 'draft' end,
    published_at = case when is_published then now() else null end,
    last_published_at = case when is_published then now() else null end;

update public.edu_lessons l
set publication_status = case when c.is_published then 'published' else 'draft' end,
    published_at = case when c.is_published then now() else null end,
    last_published_at = case when c.is_published then now() else null end
from public.edu_courses c
where c.id = l.course_id;

update public.edu_resources r
set publication_status = case when c.is_published then 'published' else 'draft' end,
    published_at = case when c.is_published then now() else null end,
    last_published_at = case when c.is_published then now() else null end
from public.edu_courses c
where c.id = r.course_id;

create index edu_courses_instructor_publication_idx
  on public.edu_courses (instructor_id, publication_status, updated_at desc);
create index edu_lessons_course_publication_order_idx
  on public.edu_lessons (course_id, publication_status, lesson_order);
create index edu_resources_course_publication_idx
  on public.edu_resources (course_id, publication_status, created_at desc);

create or replace function private.sync_edu_course_publication_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_next_status text;
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    if new.publication_status = 'published' or new.is_published is true then
      new.publication_status := 'published';
      new.is_published := true;
      new.published_at := v_now;
      new.last_published_at := v_now;
    else
      new.is_published := false;
      new.published_at := null;
      new.last_published_at := null;
    end if;
    return new;
  end if;

  if new.publication_status is distinct from old.publication_status then
    v_next_status := new.publication_status;
  elsif new.is_published is distinct from old.is_published then
    v_next_status := case when new.is_published then 'published' else 'draft' end;
  else
    v_next_status := old.publication_status;
  end if;

  new.publication_status := v_next_status;
  if v_next_status = 'published' then
    new.is_published := true;
    if old.publication_status is distinct from 'published' then
      new.published_at := v_now;
      new.last_published_at := v_now;
    else
      -- Ignore client attempts to backdate or reset an active publication.
      new.published_at := old.published_at;
      new.last_published_at := old.last_published_at;
    end if;
  else
    new.is_published := false;
    new.published_at := null;
    new.last_published_at := old.last_published_at;
  end if;

  return new;
end;
$function$;

create or replace function private.sync_edu_child_publication_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    if new.publication_status = 'published' then
      new.published_at := v_now;
      new.last_published_at := v_now;
    else
      new.published_at := null;
      new.last_published_at := null;
    end if;
    return new;
  end if;

  if new.publication_status is distinct from old.publication_status then
    if new.publication_status = 'published' then
      new.published_at := v_now;
      new.last_published_at := v_now;
    else
      new.published_at := null;
      new.last_published_at := old.last_published_at;
    end if;
  else
    -- Publication timestamps are server-managed, not client-editable.
    new.published_at := old.published_at;
    new.last_published_at := old.last_published_at;
  end if;

  return new;
end;
$function$;

create trigger edu_courses_sync_publication_state
before insert or update of publication_status, is_published, published_at, last_published_at
on public.edu_courses
for each row execute function private.sync_edu_course_publication_state();

create trigger edu_lessons_sync_publication_state
before insert or update of publication_status, published_at, last_published_at
on public.edu_lessons
for each row execute function private.sync_edu_child_publication_state();

create trigger edu_resources_sync_publication_state
before insert or update of publication_status, published_at, last_published_at
on public.edu_resources
for each row execute function private.sync_edu_child_publication_state();

create or replace function private.enforce_academy_publication_delete_window()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $function$
begin
  if old.publication_status = 'published'
     and (old.published_at is null or old.published_at > now() - interval '30 days') then
    raise exception 'Published Academy content must remain available for 30 days from its latest publication. Unpublish or archive it first.'
      using errcode = '55000';
  end if;

  return old;
end;
$function$;

create trigger edu_courses_enforce_publication_delete_window
before delete on public.edu_courses
for each row execute function private.enforce_academy_publication_delete_window();

create trigger edu_lessons_enforce_publication_delete_window
before delete on public.edu_lessons
for each row execute function private.enforce_academy_publication_delete_window();

create trigger edu_resources_enforce_publication_delete_window
before delete on public.edu_resources
for each row execute function private.enforce_academy_publication_delete_window();

revoke all on function private.sync_edu_course_publication_state() from public, anon, authenticated;
revoke all on function private.sync_edu_child_publication_state() from public, anon, authenticated;
revoke all on function private.enforce_academy_publication_delete_window() from public, anon, authenticated;

-- Course deletion must pass through the title-confirmation RPC. This protects
-- the existing ON DELETE CASCADE relationships to enrolments, lessons,
-- resources, learner progress, and saved items.
drop policy if exists edu_courses_delete_own on public.edu_courses;
revoke delete on table public.edu_courses from public, anon, authenticated;

create or replace function public.delete_academy_course(
  p_course_id uuid,
  p_confirmation_title text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_title text;
  v_instructor_id uuid;
  v_active_learners integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select c.title, c.instructor_id
    into v_title, v_instructor_id
  from public.edu_courses c
  where c.id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if v_instructor_id is distinct from auth.uid() then
    raise exception 'You do not own this course' using errcode = '42501';
  end if;

  if p_confirmation_title is distinct from v_title then
    raise exception 'Type the exact course title to confirm permanent deletion' using errcode = '22023';
  end if;

  select count(*)::integer
    into v_active_learners
  from public.edu_enrollments e
  where e.course_id = p_course_id
    and e.status in ('active', 'completed');

  delete from public.edu_courses
  where id = p_course_id
    and instructor_id = auth.uid();

  return v_active_learners;
end;
$function$;

revoke all on function public.delete_academy_course(uuid, text) from public, anon;
grant execute on function public.delete_academy_course(uuid, text) to authenticated;

-- Learner-facing lesson and resource reads require the item itself and its
-- parent course to be published. Preview and enrolment rules remain intact.
drop policy if exists edu_lessons_read_preview_or_enrolled on public.edu_lessons;
create policy edu_lessons_read_preview_or_enrolled
  on public.edu_lessons for select to anon, authenticated
  using (
    publication_status = 'published'
    and exists (
      select 1
      from public.edu_courses c
      where c.id = edu_lessons.course_id
        and c.is_published is true
        and (
          edu_lessons.is_preview is true
          or c.instructor_id = (select auth.uid())
          or exists (
            select 1
            from public.edu_enrollments e
            where e.course_id = c.id
              and e.student_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
    )
  );

drop policy if exists edu_resources_read_enrolled_or_owner on public.edu_resources;
create policy edu_resources_read_enrolled_or_owner
  on public.edu_resources for select to authenticated
  using (
    exists (
      select 1
      from public.edu_courses c
      where c.id = edu_resources.course_id
        and (
          c.instructor_id = (select auth.uid())
          or (
            c.is_published is true
            and edu_resources.publication_status = 'published'
            and exists (
              select 1
              from public.edu_enrollments e
              where e.course_id = c.id
                and e.student_id = (select auth.uid())
                and e.status in ('active', 'completed')
            )
          )
        )
    )
  );

-- The public-resource metadata RPC must not disclose unpublished resources.
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
    and r.publication_status = 'published'
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


-- Private storage access must follow each lesson/resource's own publication
-- state as well as the parent course state. This prevents an enrolled learner
-- from retrieving an unpublished child's file through a known storage path.
drop policy if exists academy_video_read_preview_enrolled_or_owner on storage.objects;
create policy academy_video_read_preview_enrolled_or_owner
  on storage.objects for select to authenticated
  using (
    bucket_id = 'academy-videos'
    and exists (
      select 1
      from public.edu_lessons l
      join public.edu_courses c on c.id = l.course_id
      where l.video_url = objects.name
        and l.publication_status = 'published'
        and c.is_published is true
        and (
          c.instructor_id = (select auth.uid())
          or l.is_preview is true
          or exists (
            select 1 from public.edu_enrollments e
            where e.course_id = c.id
              and e.student_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
    )
  );

drop policy if exists academy_resource_read_enrolled_or_owner on storage.objects;
create policy academy_resource_read_enrolled_or_owner
  on storage.objects for select to authenticated
  using (
    bucket_id = 'academy-resources'
    and exists (
      select 1
      from public.edu_resources r
      join public.edu_courses c on c.id = r.course_id
      where r.r2_object_key = objects.name
        and r.publication_status = 'published'
        and c.is_published is true
        and (
          c.instructor_id = (select auth.uid())
          or exists (
            select 1 from public.edu_enrollments e
            where e.course_id = c.id
              and e.student_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
    )
  );
