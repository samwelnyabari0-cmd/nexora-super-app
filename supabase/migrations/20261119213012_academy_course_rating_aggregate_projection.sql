-- Replace the public SECURITY DEFINER aggregate RPC with a read-only
-- aggregate projection. Raw ratings remain private; only averages/counts are public.

drop function if exists public.get_edu_course_rating_summary(uuid);

create table public.edu_course_rating_summaries (
  course_id uuid primary key references public.edu_courses(id) on delete cascade,
  average_rating numeric not null check (average_rating >= 1 and average_rating <= 5),
  rating_count bigint not null check (rating_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.edu_course_rating_summaries enable row level security;
revoke all on table public.edu_course_rating_summaries from public, anon, authenticated;
grant select on table public.edu_course_rating_summaries to anon, authenticated;

create policy edu_course_rating_summaries_published_read
on public.edu_course_rating_summaries
for select to anon, authenticated
using (
  exists (
    select 1 from public.edu_courses as c
    where c.id = edu_course_rating_summaries.course_id
      and c.is_published is true
      and c.publication_status = 'published'
  )
);

create or replace function private.sync_edu_course_rating_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_course_id uuid;
begin
  if tg_op = 'UPDATE' and old.course_id is distinct from new.course_id then
    delete from public.edu_course_rating_summaries where course_id = old.course_id;
    insert into public.edu_course_rating_summaries (course_id, average_rating, rating_count)
    select old.course_id, pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 2), pg_catalog.count(*)
    from public.edu_course_ratings as r
    where r.course_id = old.course_id
    having pg_catalog.count(*) > 0;
  end if;

  if tg_op = 'DELETE' then
    v_course_id := old.course_id;
  else
    v_course_id := new.course_id;
  end if;

  delete from public.edu_course_rating_summaries where course_id = v_course_id;
  insert into public.edu_course_rating_summaries (course_id, average_rating, rating_count)
  select v_course_id, pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 2), pg_catalog.count(*)
  from public.edu_course_ratings as r
  where r.course_id = v_course_id
  having pg_catalog.count(*) > 0;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

alter function private.sync_edu_course_rating_summary() owner to postgres;
revoke all on function private.sync_edu_course_rating_summary() from public, anon, authenticated;

create trigger edu_course_ratings_sync_summary
after insert or update or delete on public.edu_course_ratings
for each row execute function private.sync_edu_course_rating_summary();

insert into public.edu_course_rating_summaries (course_id, average_rating, rating_count)
select r.course_id, pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 2), pg_catalog.count(*)
from public.edu_course_ratings as r
group by r.course_id;

comment on table public.edu_course_rating_summaries is
  'Aggregate-only public course rating projection; contains no learner identifiers or individual ratings.';
