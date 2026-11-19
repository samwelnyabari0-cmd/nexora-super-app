-- Run after applying the Academy resource-preview table migration.
-- Read-only structural assertions: this script makes no database changes.
do $verification$
declare
  v_relation_kind "char";
  v_rls_enabled boolean;
  v_columns text[];
  v_has_key boolean;
begin
  select c.relkind, c.relrowsecurity
    into v_relation_kind, v_rls_enabled
  from pg_class c
  where c.oid = 'public.edu_resource_previews'::regclass;

  if v_relation_kind <> 'r' then
    raise exception 'Expected edu_resource_previews to be a regular table; got relkind=%', v_relation_kind;
  end if;

  if v_rls_enabled is not true then
    raise exception 'RLS must be enabled on edu_resource_previews';
  end if;

  select array_agg(a.attname::text order by a.attnum)
    into v_columns
  from pg_attribute a
  where a.attrelid = 'public.edu_resource_previews'::regclass
    and a.attnum > 0
    and not a.attisdropped;

  if v_columns is distinct from array[
    'id', 'course_id', 'resource_name', 'file_type', 'file_size_bytes', 'access_tier'
  ]::text[] then
    raise exception 'Unexpected preview columns: %', v_columns;
  end if;

  select exists (
    select 1
    from pg_attribute a
    where a.attrelid = 'public.edu_resource_previews'::regclass
      and a.attname = 'r2_object_key'
      and not a.attisdropped
  ) into v_has_key;

  if v_has_key then
    raise exception 'Storage object key must never exist on the preview relation';
  end if;

  if not has_table_privilege('anon', 'public.edu_resource_previews', 'SELECT')
     or not has_table_privilege('authenticated', 'public.edu_resource_previews', 'SELECT') then
    raise exception 'anon and authenticated must have SELECT on preview metadata';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'edu_resource_previews'
      and policyname = 'edu_resource_previews_public_read'
      and cmd = 'SELECT'
      and roles @> array['anon', 'authenticated']::name[]
      and qual = 'true'
  ) then
    raise exception 'Expected a SELECT-only public metadata policy for anon and authenticated';
  end if;

  if has_function_privilege('anon', 'private.sync_edu_resource_preview_row()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.sync_edu_resource_preview_row()', 'EXECUTE')
     or has_function_privilege('anon', 'private.sync_edu_course_resource_previews()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.sync_edu_course_resource_previews()', 'EXECUTE') then
    raise exception 'Client roles must not be able to execute internal preview trigger functions';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'edu_resources_sync_public_preview'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname = 'edu_courses_sync_public_preview'
      and not tgisinternal
  ) then
    raise exception 'Both resource and course preview synchronization triggers must exist';
  end if;

  if has_table_privilege('anon', 'public.edu_resource_previews', 'INSERT')
     or has_table_privilege('anon', 'public.edu_resource_previews', 'UPDATE')
     or has_table_privilege('anon', 'public.edu_resource_previews', 'DELETE')
     or has_table_privilege('authenticated', 'public.edu_resource_previews', 'INSERT')
     or has_table_privilege('authenticated', 'public.edu_resource_previews', 'UPDATE')
     or has_table_privilege('authenticated', 'public.edu_resource_previews', 'DELETE') then
    raise exception 'Client roles must not have write privileges on preview metadata';
  end if;

  if exists (
    select 1
    from public.edu_resource_previews p
    join public.edu_resources r on r.id = p.id
    join public.edu_courses c on c.id = p.course_id
    where r.publication_status <> 'published'
       or c.is_published is not true
       or c.publication_status <> 'published'
  ) then
    raise exception 'Unpublished resources or courses must not have preview rows';
  end if;
end;
$verification$;

-- Expected counts should match the number of published resources in published courses.
select
  (select count(*) from public.edu_resource_previews) as preview_rows,
  (select count(*)
   from public.edu_resources r
   join public.edu_courses c on c.id = r.course_id
   where r.publication_status = 'published'
     and c.is_published is true
     and c.publication_status = 'published') as expected_rows;
