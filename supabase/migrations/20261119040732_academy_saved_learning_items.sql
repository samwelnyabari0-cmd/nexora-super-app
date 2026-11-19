create table public.edu_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('course', 'lesson', 'resource', 'educator')),
  course_id uuid references public.edu_courses(id) on delete cascade,
  lesson_id uuid references public.edu_lessons(id) on delete cascade,
  resource_id uuid references public.edu_resources(id) on delete cascade,
  educator_id uuid references public.profiles(id) on delete cascade,
  saved_at timestamptz not null default now(),
  constraint edu_saved_items_matching_reference check (
    (item_type = 'course' and course_id is not null and lesson_id is null and resource_id is null and educator_id is null)
    or
    (item_type = 'lesson' and course_id is null and lesson_id is not null and resource_id is null and educator_id is null)
    or
    (item_type = 'resource' and course_id is null and lesson_id is null and resource_id is not null and educator_id is null)
    or
    (item_type = 'educator' and course_id is null and lesson_id is null and resource_id is null and educator_id is not null)
  ),
  constraint edu_saved_items_owner_item_unique
    unique nulls not distinct (user_id, item_type, course_id, lesson_id, resource_id, educator_id)
);

create index edu_saved_items_user_saved_at_idx
  on public.edu_saved_items (user_id, saved_at desc);

alter table public.edu_saved_items enable row level security;

create policy "edu_saved_items_select_own"
  on public.edu_saved_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "edu_saved_items_insert_own"
  on public.edu_saved_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "edu_saved_items_delete_own"
  on public.edu_saved_items for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.edu_saved_items from public, anon;
grant select, insert, delete on public.edu_saved_items to authenticated;
