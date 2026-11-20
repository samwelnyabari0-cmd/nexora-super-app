-- Read-only structural verification for Academy course certificates.
do $verify$
declare
  v_columns text[];
begin
  if not (select relrowsecurity from pg_class where oid='public.edu_course_certificates'::regclass) then
    raise exception 'RLS is disabled on edu_course_certificates';
  end if;

  if has_table_privilege('anon','public.edu_course_certificates','select')
     or has_table_privilege('anon','public.edu_course_certificates','insert')
     or has_table_privilege('anon','public.edu_course_certificates','update')
     or has_table_privilege('anon','public.edu_course_certificates','delete') then
    raise exception 'anon must not access certificate storage directly';
  end if;

  if not has_table_privilege('authenticated','public.edu_course_certificates','select')
     or has_table_privilege('authenticated','public.edu_course_certificates','insert')
     or has_table_privilege('authenticated','public.edu_course_certificates','update')
     or has_table_privilege('authenticated','public.edu_course_certificates','delete') then
    raise exception 'Authenticated users must have read-only access to certificate storage';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='edu_course_certificates'
      and policyname='edu_course_certificates_select_own'
      and cmd='SELECT'
      and qual like '%auth.uid()%'
  ) then
    raise exception 'Owner-only certificate SELECT policy missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.edu_course_certificates'::regclass
      and conname='edu_course_certificates_course_student_key'
  ) then
    raise exception 'One-certificate-per-learner/course constraint missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid='public.issue_edu_course_certificate(uuid)'::regprocedure
      and p.prosecdef is true
      and p.proconfig @> array['search_path=""']
      and pg_get_userbyid(p.proowner)='postgres'
  ) then
    raise exception 'Issue RPC must be postgres-owned SECURITY DEFINER with empty search_path';
  end if;

  if not has_function_privilege('authenticated','public.issue_edu_course_certificate(uuid)','execute')
     or has_function_privilege('anon','public.issue_edu_course_certificate(uuid)','execute') then
    raise exception 'Issue RPC must be callable only by authenticated users';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid='public.verify_edu_course_certificate(text)'::regprocedure
      and p.prosecdef is true
      and p.proconfig @> array['search_path=""']
      and pg_get_userbyid(p.proowner)='postgres'
  ) then
    raise exception 'Verification RPC must be postgres-owned SECURITY DEFINER with empty search_path';
  end if;

  if not has_function_privilege('anon','public.verify_edu_course_certificate(text)','execute')
     or not has_function_privilege('authenticated','public.verify_edu_course_certificate(text)','execute') then
    raise exception 'Public verification RPC must be callable by anon and authenticated';
  end if;

  select array_agg(a.attname::text order by a.attnum)
  into v_columns
  from pg_attribute a
  where a.attrelid='public.edu_course_certificates'::regclass
    and a.attnum > 0 and not a.attisdropped;

  if v_columns is distinct from array[
    'id','course_id','student_id','learner_name','course_title',
    'instructor_name','verification_code','issued_at','created_at'
  ]::text[] then
    raise exception 'Unexpected certificate storage columns: %', v_columns;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='edu_course_certificates'
      and cmd in ('INSERT','UPDATE','DELETE','ALL')
  ) then
    raise exception 'Direct client write policies must not exist';
  end if;
end;
$verify$;
