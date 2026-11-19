-- Read-only structural/security verification for Academy ratings and notes.
do $verify$
declare
  v_summary_columns text[];
  v_rating_policy_count integer;
  v_note_policy_count integer;
begin
  if not (select relrowsecurity from pg_class where oid='public.edu_course_ratings'::regclass) then
    raise exception 'RLS is disabled on edu_course_ratings';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.edu_learning_notes'::regclass) then
    raise exception 'RLS is disabled on edu_learning_notes';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.edu_course_rating_summaries'::regclass) then
    raise exception 'RLS is disabled on edu_course_rating_summaries';
  end if;

  if has_table_privilege('anon','public.edu_course_ratings','select')
     or has_table_privilege('anon','public.edu_learning_notes','select') then
    raise exception 'anon must not read raw ratings or private notes';
  end if;
  if not has_table_privilege('anon','public.edu_course_rating_summaries','select') then
    raise exception 'anon must be able to read aggregate summaries';
  end if;
  if has_table_privilege('anon','public.edu_course_rating_summaries','insert')
     or has_table_privilege('anon','public.edu_course_rating_summaries','update')
     or has_table_privilege('anon','public.edu_course_rating_summaries','delete') then
    raise exception 'anon must not write aggregate summaries';
  end if;

  if has_table_privilege('authenticated','public.edu_course_ratings','delete') then
    raise exception 'Learners must not be able to delete ratings';
  end if;
  if not has_column_privilege('authenticated','public.edu_course_ratings','rating','update')
     or has_column_privilege('authenticated','public.edu_course_ratings','student_id','update')
     or has_column_privilege('authenticated','public.edu_course_ratings','course_id','update') then
    raise exception 'Rating updates must be limited to the rating column';
  end if;
  if not has_table_privilege('authenticated','public.edu_learning_notes','delete') then
    raise exception 'Learners must be able to delete their own notes';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.edu_course_ratings'::regclass
      and conname='edu_course_ratings_rating_range'
  ) then raise exception 'Rating 1-5 constraint missing'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.edu_course_ratings'::regclass
      and conname='edu_course_ratings_course_student_key'
  ) then raise exception 'One-rating-per-learner constraint missing'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.edu_learning_notes'::regclass
      and conname='edu_learning_notes_lesson_course_fkey'
  ) then raise exception 'Lesson/course consistency foreign key missing'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.edu_learning_notes'::regclass
      and conname='edu_learning_notes_title_length'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='public.edu_learning_notes'::regclass
      and conname='edu_learning_notes_body_length'
  ) then raise exception 'Approved note length constraints missing'; end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='edu_course_ratings' and cmd='DELETE'
  ) then
    raise exception 'Learners must not have a rating DELETE policy';
  end if;

  if (
    select count(*) from pg_policies
    where schemaname='public' and tablename='edu_course_ratings'
      and cmd in ('INSERT','UPDATE')
      and coalesce(qual,'') || coalesce(with_check,'') like '%active%'
      and coalesce(qual,'') || coalesce(with_check,'') like '%completed%'
  ) <> 2 then
    raise exception 'Rating writes must require active/completed enrolment';
  end if;

  if (
    select count(*) from pg_policies
    where schemaname='public' and tablename='edu_learning_notes'
      and coalesce(qual,'') || coalesce(with_check,'') like '%active%'
      and coalesce(qual,'') || coalesce(with_check,'') like '%completed%'
  ) <> 4 then
    raise exception 'Every note operation must require active/completed enrolment';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='edu_course_rating_summaries'
      and cmd='SELECT'
      and qual like '%is_published%'
      and qual like '%publication_status%'
  ) then
    raise exception 'Aggregate summaries must be restricted to published courses';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid='private.sync_edu_course_rating_summary()'::regprocedure
      and p.prosecdef is true
      and p.proconfig @> array['search_path=""']
      and pg_get_userbyid(p.proowner)='postgres'
  ) then
    raise exception 'Aggregate trigger must be a postgres-owned SECURITY DEFINER with empty search_path';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid='private.set_edu_ratings_notes_updated_at()'::regprocedure
      and p.proconfig @> array['search_path=""']
      and pg_get_userbyid(p.proowner)='postgres'
  ) then
    raise exception 'Updated_at trigger must use an empty search_path and postgres ownership';
  end if;

  select count(*) into v_rating_policy_count
  from pg_policies
  where schemaname='public' and tablename='edu_course_ratings';
  if v_rating_policy_count <> 3 then
    raise exception 'Expected three rating policies; found %', v_rating_policy_count;
  end if;

  select count(*) into v_note_policy_count
  from pg_policies
  where schemaname='public' and tablename='edu_learning_notes';
  if v_note_policy_count <> 4 then
    raise exception 'Expected four note policies; found %', v_note_policy_count;
  end if;

  select array_agg(a.attname::text order by a.attnum)
  into v_summary_columns
  from pg_attribute a
  where a.attrelid='public.edu_course_rating_summaries'::regclass
    and a.attnum > 0 and not a.attisdropped;
  if v_summary_columns is distinct from array[
    'course_id','average_rating','rating_count','updated_at'
  ]::text[] then
    raise exception 'Unexpected aggregate projection columns: %', v_summary_columns;
  end if;

  if to_regprocedure('public.get_edu_course_rating_summary(uuid)') is not null then
    raise exception 'The public SECURITY DEFINER aggregate RPC must not exist';
  end if;
  if position('public.edu_courses' in pg_get_functiondef('private.sync_edu_course_rating_summary()'::regprocedure)) = 0 then
    raise exception 'Aggregate trigger must verify the parent course still exists before rebuilding summaries';
  end if;

  if has_function_privilege('anon','private.sync_edu_course_rating_summary()','execute')
     or has_function_privilege('authenticated','private.sync_edu_course_rating_summary()','execute')
     or has_function_privilege('anon','private.set_edu_ratings_notes_updated_at()','execute')
     or has_function_privilege('authenticated','private.set_edu_ratings_notes_updated_at()','execute') then
    raise exception 'Client roles must not execute private trigger functions';
  end if;

  if not exists (select 1 from pg_trigger where tgname='edu_course_ratings_sync_summary' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='edu_course_ratings_set_updated_at' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname='edu_learning_notes_set_updated_at' and not tgisinternal) then
    raise exception 'Expected rating summary and updated_at triggers are missing';
  end if;

  -- Confirm the pre-existing Academy access policies remain present.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edu_enrollments' and policyname='edu_enrollments_read_student_or_instructor')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='edu_lessons' and policyname='edu_lessons_read_preview_or_enrolled')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='edu_courses' and policyname='edu_courses_read_published_or_owner') then
    raise exception 'A pre-existing Academy policy is missing';
  end if;
end;
$verify$;

select 'Academy ratings/notes security structure passed' as result;
