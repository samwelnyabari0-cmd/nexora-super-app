-- Allow a user to remove their own repost without exposing direct table writes.
create or replace function public.unrepost_user_media_post(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_rows integer;
  resulting_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if public.is_my_account_suspended() then
    raise exception 'This account has been suspended';
  end if;

  delete from public.user_media_post_reposts
  where post_id = target_post_id
    and user_id = current_user_id;
  get diagnostics deleted_rows = row_count;

  update public.user_media_posts
  set repost_count = greatest(coalesce(repost_count, 0) - deleted_rows, 0)
  where id = target_post_id
  returning repost_count into resulting_count;

  if not found then
    raise exception 'Post not found';
  end if;

  return coalesce(resulting_count, 0);
end;
$$;

revoke all on function public.unrepost_user_media_post(uuid) from public, anon;
grant execute on function public.unrepost_user_media_post(uuid) to authenticated;
