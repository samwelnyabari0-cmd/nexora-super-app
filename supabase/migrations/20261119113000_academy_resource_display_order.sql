-- Stable per-course ordering for creator-managed learning resources.
alter table public.edu_resources
  add column display_order integer not null default 0;

with ranked as (
  select id,
         row_number() over (partition by course_id order by created_at asc, id asc)::integer as position
  from public.edu_resources
)
update public.edu_resources r
set display_order = ranked.position
from ranked
where ranked.id = r.id;

create index edu_resources_course_display_order_idx
  on public.edu_resources (course_id, display_order, created_at);
