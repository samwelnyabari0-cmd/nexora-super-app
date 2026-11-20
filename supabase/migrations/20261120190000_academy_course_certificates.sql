-- Secure, idempotent Academy course certificates.
create table if not exists public.edu_course_certificates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.edu_courses(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete cascade,
  learner_name text not null,
  course_title text not null,
  instructor_name text not null,
  verification_code text not null unique,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint edu_course_certificates_course_student_key unique (course_id, student_id),
  constraint edu_course_certificates_verification_code_format check (verification_code ~ '^[a-f0-9]{32}$')
);

alter table public.edu_course_certificates enable row level security;
revoke all on public.edu_course_certificates from anon, authenticated;
grant select on public.edu_course_certificates to authenticated;

drop policy if exists edu_course_certificates_select_own on public.edu_course_certificates;
create policy edu_course_certificates_select_own
on public.edu_course_certificates
for select to authenticated
using (student_id = (select auth.uid()));

create or replace function public.issue_edu_course_certificate(p_course_id uuid)
returns setof public.edu_course_certificates
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student_id uuid := auth.uid();
  v_course record;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_learner_name text;
  v_instructor_name text;
begin
  if v_student_id is null then
    raise exception 'Sign in to issue your certificate.' using errcode = '28000';
  end if;

  select c.id, c.title, c.instructor_id
  into v_course
  from public.edu_courses c
  where c.id = p_course_id
    and c.is_published is true
    and c.publication_status = 'published';

  if not found then
    raise exception 'This published course is not available.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.edu_enrollments e
    where e.course_id = p_course_id
      and e.student_id = v_student_id
      and e.status in ('active', 'completed')
  ) then
    raise exception 'An active or completed enrolment is required.' using errcode = '42501';
  end if;

  select count(*)::integer
  into v_total_lessons
  from public.edu_lessons l
  where l.course_id = p_course_id
    and l.publication_status = 'published';

  if v_total_lessons = 0 then
    raise exception 'This course has no published lessons to certify.' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_completed_lessons
  from public.edu_lessons l
  join public.edu_lesson_progress p
    on p.lesson_id = l.id
   and p.student_id = v_student_id
   and p.completed is true
  where l.course_id = p_course_id
    and l.publication_status = 'published';

  if v_completed_lessons <> v_total_lessons then
    raise exception 'Complete every published lesson before requesting a certificate.' using errcode = '42501';
  end if;

  select coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    'Learner'
  )
  into v_learner_name
  from auth.users u
  where u.id = v_student_id;

  select coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    'Course instructor'
  )
  into v_instructor_name
  from auth.users u
  where u.id = v_course.instructor_id;

  insert into public.edu_course_certificates (
    course_id, student_id, learner_name, course_title, instructor_name, verification_code
  )
  values (
    p_course_id,
    v_student_id,
    coalesce(v_learner_name, 'Learner'),
    v_course.title,
    coalesce(v_instructor_name, 'Course instructor'),
    replace(gen_random_uuid()::text, '-', '')
  )
  on conflict (course_id, student_id) do nothing;

  return query
  select c.*
  from public.edu_course_certificates c
  where c.course_id = p_course_id
    and c.student_id = v_student_id;
end;
$function$;

alter function public.issue_edu_course_certificate(uuid) owner to postgres;
revoke all on function public.issue_edu_course_certificate(uuid) from public, anon;
grant execute on function public.issue_edu_course_certificate(uuid) to authenticated;

create or replace function public.verify_edu_course_certificate(p_verification_code text)
returns table (
  learner_name text,
  course_title text,
  instructor_name text,
  issued_at timestamptz,
  verification_code text,
  is_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    c.learner_name,
    c.course_title,
    c.instructor_name,
    c.issued_at,
    c.verification_code,
    true as is_valid
  from public.edu_course_certificates c
  where c.verification_code = lower(btrim(p_verification_code))
    and p_verification_code ~* '^[a-f0-9]{32}$'
  limit 1;
$function$;

alter function public.verify_edu_course_certificate(text) owner to postgres;
revoke all on function public.verify_edu_course_certificate(text) from public;
grant execute on function public.verify_edu_course_certificate(text) to anon, authenticated;
