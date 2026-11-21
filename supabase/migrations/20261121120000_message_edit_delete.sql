-- Sender-only editing and soft deletion for direct and group chat messages.
-- Soft deletion keeps message IDs intact so replies and reactions remain referentially safe.

alter table public.direct_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.chat_group_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create or replace function public.edit_direct_message(
  p_message_id uuid,
  p_body text
)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_edited_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or length(btrim(p_body)) = 0 or length(p_body) > 2000 then
    raise exception 'Message must contain 1 to 2000 characters';
  end if;

  update public.direct_messages
  set body = p_body, edited_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    and deleted_at is null
    and (expires_at is null or expires_at > now())
    and media_path is null
    and location_latitude is null
    and location_longitude is null
    and location_session_id is null
    and shared_content_id is null;

  if not found then raise exception 'Only your active text-only messages can be edited'; end if;
  select edited_at into v_edited_at from public.direct_messages where id = p_message_id;
  return v_edited_at;
end;
$$;

create or replace function public.delete_direct_message(p_message_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_deleted_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  update public.direct_messages
  set body = '',
      media_path = null,
      media_type = null,
      attachment_name = null,
      attachment_mime_type = null,
      attachment_size_bytes = null,
      location_latitude = null,
      location_longitude = null,
      location_accuracy_m = null,
      location_captured_at = null,
      location_session_id = null,
      shared_content_source = null,
      shared_content_id = null,
      shared_content_type = null,
      deleted_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    and deleted_at is null;

  if not found then raise exception 'Message not found or you are not its sender'; end if;
  select deleted_at into v_deleted_at from public.direct_messages where id = p_message_id;
  return v_deleted_at;
end;
$$;

create or replace function public.edit_group_message(
  p_message_id uuid,
  p_body text
)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_edited_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or length(btrim(p_body)) = 0 or length(p_body) > 2000 then
    raise exception 'Message must contain 1 to 2000 characters';
  end if;

  update public.chat_group_messages
  set body = p_body, edited_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    and deleted_at is null
    and (expires_at is null or expires_at > now())
    and media_path is null
    and location_latitude is null
    and location_longitude is null
    and location_session_id is null
    and shared_content_id is null
    and private.is_group_member(group_id);

  if not found then raise exception 'Only your active text-only messages in a group you belong to can be edited'; end if;
  select edited_at into v_edited_at from public.chat_group_messages where id = p_message_id;
  return v_edited_at;
end;
$$;

create or replace function public.delete_group_message(p_message_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_deleted_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  update public.chat_group_messages
  set body = '',
      media_path = null,
      media_type = null,
      attachment_name = null,
      attachment_mime_type = null,
      attachment_size_bytes = null,
      location_latitude = null,
      location_longitude = null,
      location_accuracy_m = null,
      location_captured_at = null,
      location_session_id = null,
      shared_content_source = null,
      shared_content_id = null,
      shared_content_type = null,
      deleted_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    and deleted_at is null
    and private.is_group_member(group_id);

  if not found then raise exception 'Message not found, you are not its sender, or you are no longer a group member'; end if;
  select deleted_at into v_deleted_at from public.chat_group_messages where id = p_message_id;
  return v_deleted_at;
end;
$$;

revoke all on function public.edit_direct_message(uuid, text) from public, anon;
revoke all on function public.delete_direct_message(uuid) from public, anon;
revoke all on function public.edit_group_message(uuid, text) from public, anon;
revoke all on function public.delete_group_message(uuid) from public, anon;

grant execute on function public.edit_direct_message(uuid, text) to authenticated;
grant execute on function public.delete_direct_message(uuid) to authenticated;
grant execute on function public.edit_group_message(uuid, text) to authenticated;
grant execute on function public.delete_group_message(uuid) to authenticated;
