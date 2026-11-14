-- Create in-app notifications for post likes, post comments, and direct messages.
-- Trigger functions run with a fixed empty search_path and fully-qualified object names.

create or replace function public.notify_post_like()
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
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (post_owner_id, new.user_id, 'like', 'liked your post');
  end if;

  return new;
end;
$$;

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner_id uuid;
  comment_preview text;
begin
  select user_id
    into post_owner_id
  from public.user_media_posts
  where id = new.post_id;

  if post_owner_id is not null and post_owner_id <> new.user_id then
    comment_preview := left(btrim(new.text), 160);
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (
      post_owner_id,
      new.user_id,
      'comment',
      'commented on your post: ' || comment_preview
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_id is not null
     and new.recipient_id is not null
     and new.sender_id <> new.recipient_id then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    values (new.recipient_id, new.sender_id, 'message', 'sent you a message');
  end if;

  return new;
end;
$$;

drop trigger if exists on_user_media_post_like_notify on public.user_media_post_likes;
create trigger on_user_media_post_like_notify
after insert on public.user_media_post_likes
for each row execute function public.notify_post_like();

drop trigger if exists on_user_media_post_comment_notify on public.user_media_post_comments;
create trigger on_user_media_post_comment_notify
after insert on public.user_media_post_comments
for each row execute function public.notify_post_comment();

drop trigger if exists on_direct_message_notify on public.direct_messages;
create trigger on_direct_message_notify
after insert on public.direct_messages
for each row execute function public.notify_direct_message();

revoke all on function public.notify_post_like() from public, anon, authenticated;
revoke all on function public.notify_post_comment() from public, anon, authenticated;
revoke all on function public.notify_direct_message() from public, anon, authenticated;
