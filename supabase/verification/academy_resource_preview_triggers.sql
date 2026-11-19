-- Transactional trigger-behavior verification for the Academy preview table.
-- Run only after the replacement-table migration has been applied.
-- All fixture rows are rolled back; this script does not persist test records.

begin;

do $test$
declare
  v_instructor_id uuid;
  v_course_id uuid := gen_random_uuid();
  v_resource_id uuid := gen_random_uuid();
  v_slug text := 'preview-security-' || gen_random_uuid()::text;
begin
  select c.instructor_id
    into v_instructor_id
  from public.edu_courses as c
  limit 1;

  if v_instructor_id is null then
    raise exception 'Cannot run preview trigger test: no existing course instructor is available';
  end if;

  insert into public.edu_courses (
    id, instructor_id, title, slug, publication_status, is_published
  )
  values (
    v_course_id, v_instructor_id, 'Preview security test', v_slug, 'draft', false
  );

  insert into public.edu_resources (
    id, course_id, resource_name, r2_object_key, publication_status
  )
  values (
    v_resource_id, v_course_id, 'Preview security test resource',
    'verification-only/not-a-real-storage-object', 'published'
  );

  if exists (
    select 1 from public.edu_resource_previews where id = v_resource_id
  ) then
    raise exception 'A resource in a draft course must not have a public preview';
  end if;

  update public.edu_courses
  set publication_status = 'published', is_published = true
  where id = v_course_id;

  if not exists (
    select 1 from public.edu_resource_previews
    where id = v_resource_id
      and resource_name = 'Preview security test resource'
  ) then
    raise exception 'Publishing a course must expose its already-published resource metadata';
  end if;

  update public.edu_resources
  set resource_name = 'Updated preview security test resource'
  where id = v_resource_id;

  if not exists (
    select 1 from public.edu_resource_previews
    where id = v_resource_id
      and resource_name = 'Updated preview security test resource'
  ) then
    raise exception 'Resource metadata updates must refresh the preview row';
  end if;

  update public.edu_resources
  set publication_status = 'draft'
  where id = v_resource_id;

  if exists (
    select 1 from public.edu_resource_previews where id = v_resource_id
  ) then
    raise exception 'Unpublishing a resource must remove its preview row';
  end if;

  update public.edu_resources
  set publication_status = 'published'
  where id = v_resource_id;

  if not exists (
    select 1 from public.edu_resource_previews where id = v_resource_id
  ) then
    raise exception 'Republishing a resource in a published course must restore its preview row';
  end if;

  update public.edu_courses
  set publication_status = 'draft', is_published = false
  where id = v_course_id;

  if exists (
    select 1 from public.edu_resource_previews where id = v_resource_id
  ) then
    raise exception 'Unpublishing a course must remove all its resource previews';
  end if;

  update public.edu_courses
  set publication_status = 'published'
  where id = v_course_id;

  if not exists (
    select 1 from public.edu_resource_previews where id = v_resource_id
  ) then
    raise exception 'Republishing a course must restore metadata for its published resources';
  end if;

  -- Respect the existing 30-day publication delete guard during cleanup.
  update public.edu_resources
  set publication_status = 'draft'
  where id = v_resource_id;

  delete from public.edu_resources where id = v_resource_id;

  update public.edu_courses
  set publication_status = 'draft'
  where id = v_course_id;

  delete from public.edu_courses where id = v_course_id;
end;
$test$;

rollback;
