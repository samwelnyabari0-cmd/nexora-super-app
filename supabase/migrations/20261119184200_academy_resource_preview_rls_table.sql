-- Replace the privileged Academy resource preview view with a regular RLS-protected
-- metadata table. Storage object keys remain available only through edu_resources RLS.
-- This migration is intentionally separate from the already-applied
-- 20261119183216_academy_resource_preview_safe_metadata migration.

drop view if exists public.edu_resource_previews;

create table public.edu_resource_previews (
  id uuid primary key
    references public.edu_resources(id) on delete cascade,
  course_id uuid not null
    references public.edu_courses(id) on delete cascade,
  resource_name text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  access_tier text not null
);

alter table public.edu_resource_previews enable row level security;

revoke all on table public.edu_resource_previews from public, anon, authenticated;
grant select on table public.edu_resource_previews to anon, authenticated;

create policy edu_resource_previews_public_read
on public.edu_resource_previews
for select
to anon, authenticated
using (true);

-- Trigger-only functions maintain the public metadata projection. They are not
-- callable through the Data API and use an empty search_path plus qualified names.
create or replace function private.sync_edu_resource_preview_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.edu_resource_previews
    where id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    delete from public.edu_resource_previews
    where id = old.id;
  end if;

  insert into public.edu_resource_previews (
    id,
    course_id,
    resource_name,
    file_type,
    file_size_bytes,
    access_tier
  )
  select
    new.id,
    new.course_id,
    new.resource_name,
    new.file_type,
    new.file_size_bytes,
    new.access_tier
  from public.edu_courses as c
  where c.id = new.course_id
    and c.is_published is true
    and c.publication_status = 'published'
    and new.publication_status = 'published';

  return new;
end;
$function$;

create or replace function private.sync_edu_course_resource_previews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.edu_resource_previews
  where course_id = new.id;

  if new.is_published is true
     and new.publication_status = 'published' then
    insert into public.edu_resource_previews (
      id,
      course_id,
      resource_name,
      file_type,
      file_size_bytes,
      access_tier
    )
    select
      r.id,
      r.course_id,
      r.resource_name,
      r.file_type,
      r.file_size_bytes,
      r.access_tier
    from public.edu_resources as r
    where r.course_id = new.id
      and r.publication_status = 'published';
  end if;

  return new;
end;
$function$;

alter function private.sync_edu_resource_preview_row() owner to postgres;
alter function private.sync_edu_course_resource_previews() owner to postgres;

revoke all on function private.sync_edu_resource_preview_row() from public, anon, authenticated;
revoke all on function private.sync_edu_course_resource_previews() from public, anon, authenticated;

create trigger edu_resources_sync_public_preview
after insert or update or delete on public.edu_resources
for each row
execute function private.sync_edu_resource_preview_row();

create trigger edu_courses_sync_public_preview
after update of is_published, publication_status on public.edu_courses
for each row
execute function private.sync_edu_course_resource_previews();

-- Backfill only resources whose own publication state and parent course state
-- are both published. The preview table contains no storage object key.
insert into public.edu_resource_previews (
  id,
  course_id,
  resource_name,
  file_type,
  file_size_bytes,
  access_tier
)
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
  and c.publication_status = 'published'
  and r.publication_status = 'published';
