-- Secure Academy course ratings and private learner notes.
-- Ratings are individually visible only to their author; public clients receive
-- aggregate-only results through a narrowly scoped RPC.

create table public.edu_course_ratings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.edu_courses(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edu_course_ratings_rating_range check (rating between 1 and 5),
  constraint edu_course_ratings_course_student_key unique (course_id, student_id)
);

-- The composite key lets a note's optional lesson reference be constrained to
-- the same course, not merely to any lesson.
do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.edu_lessons'::regclass
      and conname = 'edu_lessons_id_course_id_key'
  ) then
    alter table public.edu_lessons
      add constraint edu_lessons_id_course_id_key unique (id, course_id);
  end if;
end;
$migration$;

create table public.edu_learning_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.edu_courses(id) on delete cascade,
  lesson_id uuid null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edu_learning_notes_lesson_course_fkey
    foreign key (lesson_id, course_id)
    references public.edu_lessons(id, course_id)
    on delete cascade,
  constraint edu_learning_notes_title_length
    check (char_length(title) between 1 and 100),
  constraint edu_learning_notes_body_length
    check (char_length(body) between 1 and 5000),
  constraint edu_learning_notes_title_not_blank
    check (char_length(btrim(title)) > 0),
  constraint edu_learning_notes_body_not_blank
    check (char_length(btrim(body)) > 0)
);

create index edu_learning_notes_owner_course_updated_idx
  on public.edu_learning_notes (student_id, course_id, updated_at desc);

create index edu_learning_notes_owner_lesson_updated_idx
  on public.edu_learning_notes (student_id, course_id, lesson_id, updated_at desc)
  where lesson_id is not null;

alter table public.edu_course_ratings enable row level security;
alter table public.edu_learning_notes enable row level security;

revoke all on table public.edu_course_ratings from public, anon, authenticated;
revoke all on table public.edu_learning_notes from public, anon, authenticated;

grant select on table public.edu_course_ratings to authenticated;
grant insert (course_id, student_id, rating)
  on table public.edu_course_ratings to authenticated;
grant update (rating)
  on table public.edu_course_ratings to authenticated;

grant select on table public.edu_learning_notes to authenticated;
grant insert (student_id, course_id, lesson_id, title, body)
  on table public.edu_learning_notes to authenticated;
grant update (title, body)
  on table public.edu_learning_notes to authenticated;
grant delete on table public.edu_learning_notes to authenticated;

create policy edu_course_ratings_read_own
on public.edu_course_ratings
for select
to authenticated
using (student_id = (select auth.uid()));

create policy edu_course_ratings_insert_enrolled
on public.edu_course_ratings
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_course_ratings.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy edu_course_ratings_update_enrolled
on public.edu_course_ratings
for update
to authenticated
using (student_id = (select auth.uid()))
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_course_ratings.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy edu_learning_notes_read_own_enrolled
on public.edu_learning_notes
for select
to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_learning_notes.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy edu_learning_notes_insert_own_enrolled
on public.edu_learning_notes
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_learning_notes.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy edu_learning_notes_update_own_enrolled
on public.edu_learning_notes
for update
to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_learning_notes.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
)
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_learning_notes.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create policy edu_learning_notes_delete_own_enrolled
on public.edu_learning_notes
for delete
to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.edu_enrollments as e
    where e.course_id = edu_learning_notes.course_id
      and e.student_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);

create or replace function private.set_edu_ratings_notes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

alter function private.set_edu_ratings_notes_updated_at() owner to postgres;
revoke all on function private.set_edu_ratings_notes_updated_at() from public, anon, authenticated;

create trigger edu_course_ratings_set_updated_at
before update on public.edu_course_ratings
for each row
execute function private.set_edu_ratings_notes_updated_at();

create trigger edu_learning_notes_set_updated_at
before update on public.edu_learning_notes
for each row
execute function private.set_edu_ratings_notes_updated_at();

create or replace function public.get_edu_course_rating_summary(p_course_id uuid)
returns table (average_rating numeric, rating_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 2) as average_rating,
    pg_catalog.count(r.id) as rating_count
  from public.edu_courses as c
  left join public.edu_course_ratings as r
    on r.course_id = c.id
  where c.id = p_course_id
    and c.is_published is true
    and c.publication_status = 'published'
  group by c.id;
$function$;

alter function public.get_edu_course_rating_summary(uuid) owner to postgres;
revoke all on function public.get_edu_course_rating_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_edu_course_rating_summary(uuid) to anon, authenticated;

comment on table public.edu_course_ratings is
  'Private per-learner Academy course ratings; public summaries are exposed only through get_edu_course_rating_summary.';
comment on table public.edu_learning_notes is
  'Private learner-owned notes for an Academy course or one of its lessons.';
comment on function public.get_edu_course_rating_summary(uuid) is
  'Returns only the average rating and count for a published Academy course.';
