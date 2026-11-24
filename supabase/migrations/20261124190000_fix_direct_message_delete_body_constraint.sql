-- Keep soft-deleted direct messages within direct_messages_body_check.
-- The constraint requires a non-empty body whenever media_path is null.

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
  set body = 'This message was deleted',
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

revoke all on function public.delete_direct_message(uuid) from public, anon;
grant execute on function public.delete_direct_message(uuid) to authenticated;
