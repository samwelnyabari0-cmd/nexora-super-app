-- Let visitors see metadata for published resources in published courses.
-- Actual file reads remain protected by the academy-resources storage policy,
-- which still requires an active/completed enrolment or course ownership.
drop policy if exists edu_resources_read_enrolled_or_owner on public.edu_resources;

create policy edu_resources_read_published_or_owner
on public.edu_resources
for select
to anon, authenticated
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
        )
      )
  )
);
