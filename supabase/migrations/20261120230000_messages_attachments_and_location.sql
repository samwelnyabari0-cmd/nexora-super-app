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


-- One-time and foreground-only live location sharing.
create table if not exists public.chat_location_shares (
  id uuid primary key default gen_random_uuid(),
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.chat_groups(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  stopped_at timestamptz,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  last_updated_at timestamptz not null default now(),
  constraint chat_location_shares_chat_target_check check (
    (chat_kind = 'direct' and recipient_id is not null and recipient_id <> sender_id and group_id is null)
    or
    (chat_kind = 'group' and group_id is not null and recipient_id is null)
  ),
  constraint chat_location_shares_expiry_check check (expires_at > started_at)
);

create index if not exists chat_location_shares_sender_expiry_idx
  on public.chat_location_shares(sender_id, expires_at desc);
create index if not exists chat_location_shares_group_expiry_idx
  on public.chat_location_shares(group_id, expires_at desc)
  where group_id is not null;

alter table public.chat_location_shares enable row level security;
revoke all on public.chat_location_shares from public, anon, authenticated;

create or replace function public.start_chat_location_share(
  p_chat_kind text,
  p_recipient_id uuid,
  p_group_id uuid,
  p_duration_minutes integer,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_duration_minutes not in (15, 60) then
    raise exception 'Live location duration must be 15 or 60 minutes';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180
     or (p_accuracy_m is not null and p_accuracy_m < 0) then
    raise exception 'Invalid location coordinates';
  end if;

  if p_chat_kind = 'direct' then
    if p_recipient_id is null or p_recipient_id = v_user_id or p_group_id is not null then
      raise exception 'Invalid direct conversation target';
    end if;
    if not exists (
      select 1 from public.direct_messages dm
      where (dm.sender_id = v_user_id and dm.recipient_id = p_recipient_id)
         or (dm.sender_id = p_recipient_id and dm.recipient_id = v_user_id)
    ) then
      raise exception 'A direct conversation must exist before sharing location';
    end if;
  elsif p_chat_kind = 'group' then
    if p_group_id is null or p_recipient_id is not null
       or not private.is_group_member(p_group_id) then
      raise exception 'Current group membership is required';
    end if;
  else
    raise exception 'Unsupported chat kind';
  end if;

  insert into public.chat_location_shares (
    chat_kind, sender_id, recipient_id, group_id, expires_at,
    latitude, longitude, accuracy_m, last_updated_at
  )
  values (
    p_chat_kind, v_user_id, p_recipient_id, p_group_id,
    now() + make_interval(mins => p_duration_minutes),
    p_latitude, p_longitude, p_accuracy_m, now()
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.update_chat_location_share(
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_updated_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180
     or (p_accuracy_m is not null and p_accuracy_m < 0) then
    raise exception 'Invalid location coordinates';
  end if;

  update public.chat_location_shares
  set latitude = p_latitude,
      longitude = p_longitude,
      accuracy_m = p_accuracy_m,
      last_updated_at = now()
  where id = p_session_id
    and sender_id = auth.uid()
    and stopped_at is null
    and expires_at > now()
  returning last_updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception 'Location session is no longer active';
  end if;
  return v_updated_at;
end;
$$;

create or replace function public.stop_chat_location_share(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_stopped boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.chat_location_shares
  set stopped_at = coalesce(stopped_at, now())
  where id = p_session_id
    and sender_id = auth.uid()
  returning true into v_stopped;

  if not coalesce(v_stopped, false) then
    raise exception 'Location session not found';
  end if;
  return true;
end;
$$;

create or replace function public.get_chat_location_share(p_session_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  started_at timestamptz,
  expires_at timestamptz,
  stopped_at timestamptz,
  last_updated_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    s.id,
    s.sender_id,
    case when s.stopped_at is null and s.expires_at > now() then s.latitude else null end,
    case when s.stopped_at is null and s.expires_at > now() then s.longitude else null end,
    case when s.stopped_at is null and s.expires_at > now() then s.accuracy_m else null end,
    s.started_at,
    s.expires_at,
    s.stopped_at,
    s.last_updated_at,
    case
      when s.stopped_at is not null then 'stopped'
      when s.expires_at <= now() then 'expired'
      when s.last_updated_at < now() - interval '45 seconds' then 'stale'
      else 'live'
    end
  from public.chat_location_shares s
  where s.id = p_session_id
    and (
      s.sender_id = v_user_id
      or (s.chat_kind = 'direct' and s.recipient_id = v_user_id)
      or (s.chat_kind = 'group' and private.is_group_member(s.group_id))
    );
end;
$$;

revoke all on function public.start_chat_location_share(text, uuid, uuid, integer, double precision, double precision, double precision) from public, anon;
revoke all on function public.update_chat_location_share(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.stop_chat_location_share(uuid) from public, anon;
revoke all on function public.get_chat_location_share(uuid) from public, anon;
grant execute on function public.start_chat_location_share(text, uuid, uuid, integer, double precision, double precision, double precision) to authenticated;
grant execute on function public.update_chat_location_share(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.stop_chat_location_share(uuid) to authenticated;
grant execute on function public.get_chat_location_share(uuid) to authenticated;

alter table public.direct_messages
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_captured_at timestamptz,
  add column if not exists location_session_id uuid references public.chat_location_shares(id) on delete set null;

alter table public.chat_group_messages
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_captured_at timestamptz,
  add column if not exists location_session_id uuid references public.chat_location_shares(id) on delete set null;

alter table public.direct_messages
  drop constraint if exists direct_messages_location_payload_check;
alter table public.direct_messages
  add constraint direct_messages_location_payload_check
  check (
    (location_latitude is null and location_longitude is null and location_accuracy_m is null and location_captured_at is null)
    or
    (location_latitude is not null and location_longitude is not null
      and location_latitude between -90 and 90 and location_longitude between -180 and 180
      and location_captured_at is not null
      and (location_accuracy_m is null or location_accuracy_m >= 0))
  );

alter table public.chat_group_messages
  drop constraint if exists chat_group_messages_location_payload_check;
alter table public.chat_group_messages
  add constraint chat_group_messages_location_payload_check
  check (
    (location_latitude is null and location_longitude is null and location_accuracy_m is null and location_captured_at is null)
    or
    (location_latitude is not null and location_longitude is not null
      and location_latitude between -90 and 90 and location_longitude between -180 and 180
      and location_captured_at is not null
      and (location_accuracy_m is null or location_accuracy_m >= 0))
  );


-- Reference-only sharing of existing Nexora content. Recipients resolve each item under their own RLS.
alter table public.direct_messages
  add column if not exists shared_content_source text,
  add column if not exists shared_content_id uuid,
  add column if not exists shared_content_type text;

alter table public.chat_group_messages
  add column if not exists shared_content_source text,
  add column if not exists shared_content_id uuid,
  add column if not exists shared_content_type text;

alter table public.direct_messages
  drop constraint if exists direct_messages_shared_content_check;
alter table public.direct_messages
  add constraint direct_messages_shared_content_check
  check (
    (shared_content_source is null and shared_content_id is null and shared_content_type is null)
    or
    (shared_content_id is not null and shared_content_source is not null and shared_content_source = 'posts' and shared_content_type is not null and shared_content_type = 'post')
    or
    (shared_content_id is not null and shared_content_source is not null and shared_content_source = 'user_media_posts'
      and shared_content_type is not null and shared_content_type = any (array['post', 'reel', 'video']::text[]))
  );

alter table public.chat_group_messages
  drop constraint if exists chat_group_messages_shared_content_check;
alter table public.chat_group_messages
  add constraint chat_group_messages_shared_content_check
  check (
    (shared_content_source is null and shared_content_id is null and shared_content_type is null)
    or
    (shared_content_id is not null and shared_content_source = 'posts' and shared_content_type = 'post')
    or
    (shared_content_id is not null and shared_content_source = 'user_media_posts'
      and shared_content_type = any (array['post', 'reel', 'video']::text[]))
  );

create index if not exists direct_messages_shared_content_idx
  on public.direct_messages(shared_content_source, shared_content_id)
  where shared_content_id is not null;
create index if not exists chat_group_messages_shared_content_idx
  on public.chat_group_messages(shared_content_source, shared_content_id)
  where shared_content_id is not null;
