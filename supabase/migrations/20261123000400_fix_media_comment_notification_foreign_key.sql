create or replace function public.notify_user_media_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner_id uuid;
begin
  select user_id
    into post_owner_id
  from public.user_media_posts
  where id = new.post_id;

  if post_owner_id is not null and post_owner_id <> new.user_id then
    -- notifications.post_id references public.posts(id), not user_media_posts(id).
    -- Keep the activity notification but leave post_id null for media-post comments.
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (post_owner_id, new.user_id, 'comment', 'commented on your media post');
  end if;

  return new;
end;
$$;

revoke all on function public.notify_user_media_post_comment() from public, anon, authenticated;
