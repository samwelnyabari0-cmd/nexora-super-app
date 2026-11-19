-- Avoid recreating rating summaries while a course is being deleted by FK cascade.
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
    delete from public.edu_course_rating_summaries
    where course_id = old.course_id;

    if exists (select 1 from public.edu_courses as c where c.id = old.course_id) then
      insert into public.edu_course_rating_summaries (course_id, average_rating, rating_count)
      select old.course_id, pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 2), pg_catalog.count(*)
      from public.edu_course_ratings as r
      where r.course_id = old.course_id
      having pg_catalog.count(*) > 0;
    end if;
  end if;

  if tg_op = 'DELETE' then
    v_course_id := old.course_id;
  else
    v_course_id := new.course_id;
  end if;

  delete from public.edu_course_rating_summaries
  where course_id = v_course_id;

  if exists (select 1 from public.edu_courses as c where c.id = v_course_id) then
    insert into public.edu_course_rating_summaries (course_id, average_rating, rating_count)
    select v_course_id, pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 2), pg_catalog.count(*)
    from public.edu_course_ratings as r
    where r.course_id = v_course_id
    having pg_catalog.count(*) > 0;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

alter function private.sync_edu_course_rating_summary() owner to postgres;
revoke all on function private.sync_edu_course_rating_summary() from public, anon, authenticated;
