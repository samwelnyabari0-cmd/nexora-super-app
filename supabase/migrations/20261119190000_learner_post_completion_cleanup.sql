-- Learner post-completion cleanup: keep achievements while allowing learners to hide completed items.
create table if not exists public.edu_learning_hidden_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('course', 'lesson')),
  course_id uuid references public.edu_courses(id) on delete cascade,
  lesson_id uuid references public.edu_lessons(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  constraint edu_learning_hidden_items_matching_reference check (
    (item_type = 'course' and course_id is not null and lesson_id is null)
    or
    (item_type = 'lesson' and course_id is null and lesson_id is not null)
  ),
  constraint edu_learning_hidden_items_owner_item_unique
    unique nulls not distinct (user_id, item_type, course_id, lesson_id)
);

alter table public.edu_learning_hidden_items enable row level security;

create policy "edu_learning_hidden_items_select_own"
  on public.edu_learning_hidden_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "edu_learning_hidden_items_insert_completed_own"
  on public.edu_learning_hidden_items for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      (
        item_type = 'course'
        and exists (
          select 1 from public.edu_enrollments e
          where e.course_id = edu_learning_hidden_items.course_id
            and e.student_id = (select auth.uid())
            and e.status = 'completed'
        )
      )
      or
      (
        item_type = 'lesson'
        and exists (
          select 1 from public.edu_lesson_progress p
          where p.lesson_id = edu_learning_hidden_items.lesson_id
            and p.student_id = (select auth.uid())
            and p.completed is true
        )
      )
    )
  );

create policy "edu_learning_hidden_items_delete_own"
  on public.edu_learning_hidden_items for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.edu_learning_hidden_items to authenticated;

-- A small, durable completion log. Titles are snapshots so the learner can retain
-- proof of completion even if course content is later renamed or removed.
create table if not exists public.edu_completion_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('course', 'lesson')),
  course_id uuid references public.edu_courses(id) on delete set null,
  lesson_id uuid references public.edu_lessons(id) on delete set null,
  item_title text not null,
  course_title text not null,
  completed_at timestamptz not null default now(),
  constraint edu_completion_history_matching_reference check (
    (item_type = 'course' and lesson_id is null)
    or item_type = 'lesson'
  )
);

create unique index if not exists edu_completion_history_course_unique
  on public.edu_completion_history (user_id, course_id)
  where item_type = 'course' and course_id is not null;

create unique index if not exists edu_completion_history_lesson_unique
  on public.edu_completion_history (user_id, lesson_id)
  where item_type = 'lesson' and lesson_id is not null;

alter table public.edu_completion_history enable row level security;

create policy "edu_completion_history_select_own"
  on public.edu_completion_history for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.edu_completion_history to authenticated;

-- Backfill completion history for achievements recorded before this feature.
insert into public.edu_completion_history (
  user_id, item_type, course_id, lesson_id, item_title, course_title, completed_at
)
select
  p.student_id, 'lesson', l.course_id, l.id, l.title, c.title, coalesce(p.updated_at, now())
from public.edu_lesson_progress p
join public.edu_lessons l on l.id = p.lesson_id
join public.edu_courses c on c.id = l.course_id
where p.completed is true
on conflict do nothing;

-- Reconcile older courses whose lesson progress is complete but whose
-- enrollment status was never advanced by the earlier learner UI.
update public.edu_enrollments e
set status = 'completed',
    completed_at = coalesce(e.completed_at, now())
where e.status = 'active'
  and exists (
    select 1 from public.edu_lessons l where l.course_id = e.course_id
  )
  and not exists (
    select 1
    from public.edu_lessons l
    where l.course_id = e.course_id
      and not exists (
        select 1 from public.edu_lesson_progress p
        where p.lesson_id = l.id
          and p.student_id = e.student_id
          and p.completed is true
      )
  );

insert into public.edu_completion_history (
  user_id, item_type, course_id, lesson_id, item_title, course_title, completed_at
)
select
  e.student_id, 'course', e.course_id, null, c.title, c.title, coalesce(e.completed_at, now())
from public.edu_enrollments e
join public.edu_courses c on c.id = e.course_id
where e.status = 'completed'
on conflict do nothing;

create or replace function public.capture_edu_completion_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lesson_title text;
  v_course_title text;
  v_course_id uuid;
  v_all_lessons_completed boolean;
begin
  if new.completed is not true then
    return new;
  end if;

  select l.title, c.title, l.course_id
    into v_lesson_title, v_course_title, v_course_id
  from public.edu_lessons l
  join public.edu_courses c on c.id = l.course_id
  where l.id = new.lesson_id;

  if v_course_id is null then
    return new;
  end if;

  insert into public.edu_completion_history (
    user_id, item_type, course_id, lesson_id, item_title, course_title
  )
  values (
    new.student_id, 'lesson', v_course_id, new.lesson_id, v_lesson_title, v_course_title
  )
  on conflict do nothing;

  select
    exists (select 1 from public.edu_lessons l where l.course_id = v_course_id)
    and not exists (
      select 1
      from public.edu_lessons l
      where l.course_id = v_course_id
        and not exists (
          select 1
          from public.edu_lesson_progress p
          where p.lesson_id = l.id
            and p.student_id = new.student_id
            and p.completed is true
        )
    )
    into v_all_lessons_completed;

  if v_all_lessons_completed then
    update public.edu_enrollments
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where course_id = v_course_id
      and student_id = new.student_id
      and status in ('active', 'completed');

    insert into public.edu_completion_history (
      user_id, item_type, course_id, lesson_id, item_title, course_title
    )
    values (
      new.student_id, 'course', v_course_id, null, v_course_title, v_course_title
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists edu_lesson_progress_capture_completion on public.edu_lesson_progress;

create trigger edu_lesson_progress_capture_completion
  after insert or update on public.edu_lesson_progress
  for each row
  when (new.completed is true)
  execute function public.capture_edu_completion_history();

revoke all on function public.capture_edu_completion_history() from public, anon, authenticated;
