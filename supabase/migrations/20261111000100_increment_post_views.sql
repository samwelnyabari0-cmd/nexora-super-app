create or replace function public.increment_post_views(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to increment post views';
  end if;

  update public.user_media_posts
  set view_count = coalesce(view_count, 0) + 1
  where id = target_post_id
  returning view_count into updated_count;

  if updated_count is null then
    raise exception 'Post not found: %', target_post_id;
  end if;

  return updated_count;
end;
$$;

revoke all on function public.increment_post_views(uuid) from public;
grant execute on function public.increment_post_views(uuid) to authenticated;
