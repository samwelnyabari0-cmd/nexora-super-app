-- Expose safe metadata for published Academy resources without exposing storage object keys.
-- The view owner bypasses the base table RLS intentionally, but the view returns
-- only these explicitly selected metadata columns and only published course resources.
-- The original edu_resources RLS policies remain unchanged and continue to protect
-- r2_object_key for enrolled learners and course owners.

create or replace view public.edu_resource_previews
with (security_barrier = true, security_invoker = false)
as
select
  r.id,
  r.course_id,
  r.resource_name,
  r.file_type,
  r.file_size_bytes,
  r.access_tier
from public.edu_resources as r
join public.edu_courses as c on c.id = r.course_id
where c.is_published is true
  and r.publication_status = 'published';

alter view public.edu_resource_previews owner to postgres;
revoke all on public.edu_resource_previews from public;
grant select on public.edu_resource_previews to anon, authenticated;
