-- Run after applying 20261120120000_strict_reels_video_content_types.sql.
do $$
declare
  missing_columns integer;
  invalid_rows integer;
  has_type_constraint boolean;
  has_type_index boolean;
  has_owner_index boolean;
  rls_enabled boolean;
begin
  select count(*) into missing_columns
  from (values ('content_type'), ('aspect_ratio'), ('duration_seconds')) as required(column_name)
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_media_posts'
      and columns.column_name = required.column_name
  );
  if missing_columns <> 0 then
    raise exception 'Missing strict media metadata columns: %', missing_columns;
  end if;

  select count(*) into invalid_rows
  from public.user_media_posts
  where content_type not in ('post', 'reel', 'video', 'collab');
  if invalid_rows <> 0 then
    raise exception 'Found % rows with invalid content_type', invalid_rows;
  end if;

  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_media_posts'::regclass
      and conname = 'user_media_posts_content_type_check'
  ) into has_type_constraint;
  if not has_type_constraint then raise exception 'Strict content_type CHECK constraint is missing'; end if;

  select exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'user_media_posts'
      and indexname = 'user_media_posts_content_type_created_idx'
  ) into has_type_index;
  if not has_type_index then raise exception 'Content type feed index is missing'; end if;

  select exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'user_media_posts'
      and indexname = 'user_media_posts_user_content_type_created_idx'
  ) into has_owner_index;
  if not has_owner_index then raise exception 'Profile content type feed index is missing'; end if;

  select relrowsecurity into rls_enabled
  from pg_class where oid = 'public.user_media_posts'::regclass;
  if not rls_enabled then raise exception 'RLS must remain enabled on user_media_posts'; end if;
end;
$$;

select content_type, count(*) as row_count
from public.user_media_posts
group by content_type
order by content_type;
