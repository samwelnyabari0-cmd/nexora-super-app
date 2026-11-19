-- Transactional behavior verification. All inserted/updated fixtures roll back.
-- Requires at least one active/completed enrolment and one published course.

begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select e.student_id::text
    from public.edu_enrollments e
    join public.edu_courses c on c.id=e.course_id
    where e.status in ('active','completed')
      and c.is_published is true
      and c.publication_status='published'
    order by e.enrolled_at desc
    limit 1
  ),
  true
);

set local role authenticated;

do $eligible$
declare
  v_course_id uuid;
  v_lesson_id uuid;
  v_other_lesson_id uuid;
  v_rating_id uuid;
  v_note_id uuid;
  v_average numeric;
  v_count bigint;
begin
  select e.course_id into v_course_id
  from public.edu_enrollments e
  join public.edu_courses c on c.id=e.course_id
  where e.student_id=auth.uid()
    and e.status in ('active','completed')
    and c.is_published is true
    and c.publication_status='published'
  order by e.enrolled_at desc
  limit 1;

  if v_course_id is null then
    raise exception 'No eligible published course fixture exists';
  end if;

  select l.id into v_lesson_id
  from public.edu_lessons l
  where l.course_id=v_course_id
  order by l.lesson_order
  limit 1;

  select l.id into v_other_lesson_id
  from public.edu_lessons l
  where l.course_id <> v_course_id
  limit 1;

  select id into v_rating_id
  from public.edu_course_ratings
  where course_id=v_course_id and student_id=auth.uid();

  if v_rating_id is null then
    insert into public.edu_course_ratings(course_id, student_id, rating)
    values (v_course_id, auth.uid(), 3)
    returning id into v_rating_id;
  else
    update public.edu_course_ratings set rating=3 where id=v_rating_id;
  end if;

  update public.edu_course_ratings set rating=5 where id=v_rating_id;

  select average_rating, rating_count into v_average, v_count
  from public.edu_course_rating_summaries where course_id=v_course_id;
  if v_average is null or v_average < 1 or v_average > 5 or v_count < 1 then
    raise exception 'Rating aggregate failed to refresh: %, %', v_average, v_count;
  end if;

  insert into public.edu_learning_notes(student_id, course_id, lesson_id, title, body)
  values (auth.uid(), v_course_id, null, 'Course note', 'Course note body')
  returning id into v_note_id;

  if v_lesson_id is not null then
    insert into public.edu_learning_notes(student_id, course_id, lesson_id, title, body)
    values (auth.uid(), v_course_id, v_lesson_id, 'Lesson note', 'Lesson note body');
  end if;

  update public.edu_learning_notes
  set title='Edited course note', body='Edited note body'
  where id=v_note_id;

  if not exists (
    select 1 from public.edu_learning_notes
    where id=v_note_id and title='Edited course note'
  ) then raise exception 'Owner cannot read/update own note'; end if;

  begin
    insert into public.edu_learning_notes(student_id, course_id, title, body)
    values (auth.uid(), v_course_id, repeat('x',101), 'over limit');
    raise exception '101-character note title unexpectedly accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.edu_learning_notes(student_id, course_id, lesson_id, title, body)
    values (auth.uid(), v_course_id, gen_random_uuid(), 'Invalid lesson', 'Invalid lesson reference');
    raise exception 'Unknown or mismatched lesson reference unexpectedly accepted';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.edu_course_ratings(course_id, student_id, rating)
    values (v_course_id, auth.uid(), 0);
    raise exception 'Rating below 1 unexpectedly accepted';
  exception when check_violation then null;
  end;

  delete from public.edu_learning_notes where id=v_note_id;
  if exists(select 1 from public.edu_learning_notes where id=v_note_id) then
    raise exception 'Owner cannot delete own note';
  end if;
end;
$eligible$;

reset role;

-- Ineligible users cannot rate or read/write notes.
select set_config(
  'request.jwt.claim.sub',
  (
    select u.id::text
    from auth.users u
    where not exists (
      select 1 from public.edu_enrollments e
      where e.student_id=u.id and e.status in ('active','completed')
    )
    limit 1
  ),
  true
);

set local role authenticated;

do $ineligible$
declare
  v_course_id uuid;
begin
  select id into v_course_id
  from public.edu_courses
  where is_published is true and publication_status='published'
  limit 1;

  if auth.uid() is null then
    raise exception 'No ineligible test user exists';
  end if;

  if exists(select 1 from public.edu_learning_notes where student_id=auth.uid()) then
    raise exception 'Ineligible user can read private notes';
  end if;

  begin
    insert into public.edu_course_ratings(course_id, student_id, rating)
    values (v_course_id, auth.uid(), 4);
    raise exception 'Ineligible user unexpectedly inserted a rating';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.edu_learning_notes(student_id, course_id, title, body)
    values (auth.uid(), v_course_id, 'Blocked', 'Blocked');
    raise exception 'Ineligible user unexpectedly inserted a note';
  exception when insufficient_privilege then null;
  end;
end;
$ineligible$;

rollback;

-- Anonymous aggregate visibility and raw-data denial are covered by the
-- structural check (grants/RLS) and by the aggregate-only table column list.
