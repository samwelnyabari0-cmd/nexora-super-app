-- Private document attachments for direct and group messages.
-- Additive only: existing image, video, audio paths and storage policies stay in place.

alter table public.direct_messages
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

alter table public.chat_group_messages
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

alter table public.direct_messages
  drop constraint if exists direct_messages_media_type_check;
alter table public.direct_messages
  add constraint direct_messages_media_type_check
  check (media_type is null or media_type = any (array['image', 'video', 'audio', 'document']::text[]));

alter table public.chat_group_messages
  drop constraint if exists chat_group_messages_media_type_check;
alter table public.chat_group_messages
  add constraint chat_group_messages_media_type_check
  check (media_type is null or media_type = any (array['image', 'video', 'audio', 'document']::text[]));

alter table public.direct_messages
  drop constraint if exists direct_messages_document_metadata_check;
alter table public.direct_messages
  add constraint direct_messages_document_metadata_check
  check (
    media_type <> 'document'
    or (
      media_path is not null
      and attachment_name is not null
      and length(btrim(attachment_name)) > 0
      and attachment_mime_type is not null
      and attachment_mime_type = any (array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]::text[])
      and attachment_size_bytes is not null
      and attachment_size_bytes between 1 and 52428800
    )
  );

alter table public.chat_group_messages
  drop constraint if exists chat_group_messages_document_metadata_check;
alter table public.chat_group_messages
  add constraint chat_group_messages_document_metadata_check
  check (
    media_type <> 'document'
    or (
      media_path is not null
      and attachment_name is not null
      and length(btrim(attachment_name)) > 0
      and attachment_mime_type is not null
      and attachment_mime_type = any (array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]::text[])
      and attachment_size_bytes is not null
      and attachment_size_bytes between 1 and 52428800
    )
  );

-- Preserve the existing private bucket and 50 MiB limit; only add the seven document MIME types.
do $$
declare
  changed_rows integer;
begin
  update storage.buckets
  set allowed_mime_types = array(
    select distinct allowed_type
    from unnest(
      coalesce(allowed_mime_types, array[]::text[])
      || array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]::text[]
    ) as mime_types(allowed_type)
    order by allowed_type
  )
  where id = 'chat-media'
    and public is false
    and file_size_limit = 52428800;

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Expected one private chat-media bucket with a 50 MiB limit; found % matching buckets', changed_rows;
  end if;
end;
$$;
