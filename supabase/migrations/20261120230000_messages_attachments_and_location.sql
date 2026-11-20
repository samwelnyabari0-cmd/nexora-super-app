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
      select 1 from public.contacts c
      where c.status = 'accepted'
        and ((c.requester = v_user_id and c.addressee = p_recipient_id)
          or (c.requester = p_recipient_id and c.addressee = v_user_id))
    ) then
      raise exception 'Accepted contact status is required to share live location';
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

alter table public.direct_messages
  drop constraint if exists direct_messages_location_session_payload_check;
alter table public.direct_messages
  add constraint direct_messages_location_session_payload_check
  check (
    location_session_id is null
    or (location_latitude is null and location_longitude is null
      and location_accuracy_m is null and location_captured_at is null)
  );

alter table public.chat_group_messages
  drop constraint if exists chat_group_messages_location_session_payload_check;
alter table public.chat_group_messages
  add constraint chat_group_messages_location_session_payload_check
  check (
    location_session_id is null
    or (location_latitude is null and location_longitude is null
      and location_accuracy_m is null and location_captured_at is null)
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
    (shared_content_id is not null and shared_content_source is not null and shared_content_source = 'posts' and shared_content_type is not null and shared_content_type = 'post')
    or
    (shared_content_id is not null and shared_content_source is not null and shared_content_source = 'user_media_posts'
      and shared_content_type is not null and shared_content_type = any (array['post', 'reel', 'video']::text[]))
  );

create index if not exists direct_messages_shared_content_idx
  on public.direct_messages(shared_content_source, shared_content_id)
  where shared_content_id is not null;
create index if not exists chat_group_messages_shared_content_idx
  on public.chat_group_messages(shared_content_source, shared_content_id)
  where shared_content_id is not null;


-- Validate shared references as the sender, so clients cannot forge arbitrary IDs or bypass source RLS.
create or replace function public.validate_shared_message_content()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.shared_content_id is null then
    return new;
  end if;

  if new.shared_content_source = 'posts' then
    if new.shared_content_type <> 'post'
       or not exists (select 1 from public.posts p where p.id = new.shared_content_id) then
      raise exception 'This post is not available to share';
    end if;
  elsif new.shared_content_source = 'user_media_posts' then
    if not exists (
      select 1 from public.user_media_posts p
      where p.id = new.shared_content_id
        and p.content_type = new.shared_content_type
    ) then
      raise exception 'This Nexora media is not available to share';
    end if;
  else
    raise exception 'Unsupported shared content source';
  end if;

  return new;
end;
$$;

drop trigger if exists direct_messages_validate_shared_content on public.direct_messages;
create trigger direct_messages_validate_shared_content
before insert or update of shared_content_source, shared_content_id, shared_content_type
on public.direct_messages
for each row execute function public.validate_shared_message_content();

drop trigger if exists chat_group_messages_validate_shared_content on public.chat_group_messages;
create trigger chat_group_messages_validate_shared_content
before insert or update of shared_content_source, shared_content_id, shared_content_type
on public.chat_group_messages
for each row execute function public.validate_shared_message_content();

-- A live session can only be attached by its sender to the exact chat for which it was created.
create or replace function public.validate_chat_location_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.chat_location_shares%rowtype;
begin
  if new.location_session_id is null then
    return new;
  end if;
  if auth.uid() is null or new.sender_id <> auth.uid() then
    raise exception 'Only the location sender can attach this session';
  end if;

  select * into v_session
  from public.chat_location_shares
  where id = new.location_session_id;

  if not found or v_session.sender_id <> auth.uid() then
    raise exception 'Location session not found';
  end if;

  if tg_table_name = 'direct_messages' then
    if v_session.chat_kind <> 'direct' or v_session.recipient_id <> new.recipient_id then
      raise exception 'Location session belongs to another conversation';
    end if;
  elsif tg_table_name = 'chat_group_messages' then
    if v_session.chat_kind <> 'group' or v_session.group_id <> new.group_id then
      raise exception 'Location session belongs to another group';
    end if;
  else
    raise exception 'Unsupported location message table';
  end if;

  return new;
end;
$$;

drop trigger if exists direct_messages_validate_location_session on public.direct_messages;
create trigger direct_messages_validate_location_session
before insert or update of location_session_id, sender_id, recipient_id
on public.direct_messages
for each row execute function public.validate_chat_location_message();

drop trigger if exists chat_group_messages_validate_location_session on public.chat_group_messages;
create trigger chat_group_messages_validate_location_session
before insert or update of location_session_id, sender_id, group_id
on public.chat_group_messages
for each row execute function public.validate_chat_location_message();

revoke all on function public.validate_shared_message_content() from public, anon;
revoke all on function public.validate_chat_location_message() from public, anon;
grant execute on function public.validate_shared_message_content() to authenticated;
grant execute on function public.validate_chat_location_message() to authenticated;


-- Server-enforced per-chat expiry. Default is Off (retention_seconds = 0).
-- pg_cron is not installed in this project, so expired rows are hidden by RLS but are not automatically physically deleted.
create table if not exists public.chat_message_settings (
  id uuid primary key default gen_random_uuid(),
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  user_a_id uuid references auth.users(id) on delete cascade,
  user_b_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.chat_groups(id) on delete cascade,
  chat_key text generated always as (
    case
      when chat_kind = 'direct' then user_a_id::text || ':' || user_b_id::text
      else group_id::text
    end
  ) stored,
  retention_seconds integer not null default 0
    check (retention_seconds in (0, 86400, 604800, 2592000)),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_message_settings_target_check check (
    (chat_kind = 'direct' and user_a_id is not null and user_b_id is not null
      and user_a_id < user_b_id and group_id is null)
    or
    (chat_kind = 'group' and group_id is not null and user_a_id is null and user_b_id is null)
  ),
  constraint chat_message_settings_chat_unique unique (chat_kind, chat_key)
);

alter table public.chat_message_settings enable row level security;
revoke all on public.chat_message_settings from public, anon, authenticated;
grant select on public.chat_message_settings to authenticated;

drop policy if exists chat_message_settings_participants_select on public.chat_message_settings;
create policy chat_message_settings_participants_select
on public.chat_message_settings
for select to authenticated
using (
  (chat_kind = 'direct' and (auth.uid() = user_a_id or auth.uid() = user_b_id))
  or (chat_kind = 'group' and private.is_group_member(group_id))
);

create or replace function public.get_chat_disappearing_setting(
  p_chat_kind text,
  p_chat_id uuid
)
returns table (retention_seconds integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_group uuid;
  v_retention integer := 0;
  v_updated_at timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  if p_chat_kind = 'direct' then
    if p_chat_id is null or p_chat_id = v_user_id then raise exception 'Invalid direct chat'; end if;
    if not exists (
      select 1 from public.contacts c
      where c.status = 'accepted'
        and ((c.requester = v_user_id and c.addressee = p_chat_id)
          or (c.requester = p_chat_id and c.addressee = v_user_id))
    ) then raise exception 'Accepted contact status is required'; end if;
    v_a := least(v_user_id, p_chat_id);
    v_b := greatest(v_user_id, p_chat_id);
    select s.retention_seconds, s.updated_at
      into v_retention, v_updated_at
    from public.chat_message_settings s
    where s.chat_kind = 'direct' and s.user_a_id = v_a and s.user_b_id = v_b;
  elsif p_chat_kind = 'group' then
    v_group := p_chat_id;
    if v_group is null or not private.is_group_member(v_group) then
      raise exception 'Current group membership is required';
    end if;
    select s.retention_seconds, s.updated_at
      into v_retention, v_updated_at
    from public.chat_message_settings s
    where s.chat_kind = 'group' and s.group_id = v_group;
  else
    raise exception 'Unsupported chat kind';
  end if;

  return query select coalesce(v_retention, 0), v_updated_at;
end;
$$;

create or replace function public.set_chat_disappearing_setting(
  p_chat_kind text,
  p_chat_id uuid,
  p_retention_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_group uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_retention_seconds not in (0, 86400, 604800, 2592000) then
    raise exception 'Unsupported disappearing-message duration';
  end if;

  if p_chat_kind = 'direct' then
    if p_chat_id is null or p_chat_id = v_user_id then raise exception 'Invalid direct chat'; end if;
    if not exists (
      select 1 from public.contacts c
      where c.status = 'accepted'
        and ((c.requester = v_user_id and c.addressee = p_chat_id)
          or (c.requester = p_chat_id and c.addressee = v_user_id))
    ) then raise exception 'Accepted contact status is required'; end if;
    v_a := least(v_user_id, p_chat_id);
    v_b := greatest(v_user_id, p_chat_id);
    insert into public.chat_message_settings (
      chat_kind, user_a_id, user_b_id, retention_seconds, updated_by, updated_at
    )
    values ('direct', v_a, v_b, p_retention_seconds, v_user_id, now())
    on conflict (chat_kind, chat_key)
    do update set retention_seconds = excluded.retention_seconds,
                  updated_by = v_user_id,
                  updated_at = now();
  elsif p_chat_kind = 'group' then
    v_group := p_chat_id;
    if v_group is null or not private.is_group_member(v_group) then
      raise exception 'Current group membership is required';
    end if;
    insert into public.chat_message_settings (
      chat_kind, group_id, retention_seconds, updated_by, updated_at
    )
    values ('group', v_group, p_retention_seconds, v_user_id, now())
    on conflict (chat_kind, chat_key)
    do update set retention_seconds = excluded.retention_seconds,
                  updated_by = v_user_id,
                  updated_at = now();
  else
    raise exception 'Unsupported chat kind';
  end if;

  return p_retention_seconds;
end;
$$;

create or replace function public.apply_chat_message_expiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retention integer := 0;
  v_a uuid;
  v_b uuid;
begin
  if tg_table_name = 'direct_messages' then
    v_a := least(new.sender_id, new.recipient_id);
    v_b := greatest(new.sender_id, new.recipient_id);
    select s.retention_seconds into v_retention
    from public.chat_message_settings s
    where s.chat_kind = 'direct' and s.user_a_id = v_a and s.user_b_id = v_b;
  elsif tg_table_name = 'chat_group_messages' then
    select s.retention_seconds into v_retention
    from public.chat_message_settings s
    where s.chat_kind = 'group' and s.group_id = new.group_id;
  else
    raise exception 'Unsupported chat message table';
  end if;

  if coalesce(v_retention, 0) > 0 then
    new.expires_at := now() + make_interval(secs => v_retention);
  else
    new.expires_at := null;
  end if;
  return new;
end;
$$;

alter table public.direct_messages
  add column if not exists expires_at timestamptz;
alter table public.chat_group_messages
  add column if not exists expires_at timestamptz;

drop trigger if exists direct_messages_apply_expiry on public.direct_messages;
create trigger direct_messages_apply_expiry
before insert on public.direct_messages
for each row execute function public.apply_chat_message_expiry();

drop trigger if exists chat_group_messages_apply_expiry on public.chat_group_messages;
create trigger chat_group_messages_apply_expiry
before insert on public.chat_group_messages
for each row execute function public.apply_chat_message_expiry();

drop policy if exists messages_participant_select on public.direct_messages;
create policy messages_participant_select
on public.direct_messages
for select to authenticated
using (
  (auth.uid() = sender_id or auth.uid() = recipient_id)
  and (expires_at is null or expires_at > now())
);

drop policy if exists messages_recipient_update_receipts on public.direct_messages;
create policy messages_recipient_update_receipts
on public.direct_messages
for update to authenticated
using (
  auth.uid() = recipient_id
  and (expires_at is null or expires_at > now())
)
with check (
  auth.uid() = recipient_id
  and (expires_at is null or expires_at > now())
);

drop policy if exists group_members_can_view_messages on public.chat_group_messages;
create policy group_members_can_view_messages
on public.chat_group_messages
for select to authenticated
using (
  private.is_group_member(group_id)
  and (expires_at is null or expires_at > now())
);

drop policy if exists "Chat participants view media" on storage.objects;
create policy "Chat participants view media"
on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-media'
  and exists (
    select 1
    from public.direct_messages dm
    where dm.media_path = objects.name
      and (dm.sender_id = auth.uid() or dm.recipient_id = auth.uid())
      and (dm.expires_at is null or dm.expires_at > now())
  )
);

drop policy if exists "Group members view group media" on storage.objects;
create policy "Group members view group media"
on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-media'
  and (
    exists (
      select 1 from public.chat_groups g
      where g.avatar_url = objects.name
        and private.is_group_member(g.id)
    )
    or exists (
      select 1 from public.chat_group_messages gm
      where gm.media_path = objects.name
        and private.is_group_member(gm.group_id)
        and (gm.expires_at is null or gm.expires_at > now())
    )
  )
);

revoke all on function public.get_chat_disappearing_setting(text, uuid) from public, anon;
revoke all on function public.set_chat_disappearing_setting(text, uuid, integer) from public, anon;
revoke all on function public.apply_chat_message_expiry() from public, anon;
grant execute on function public.get_chat_disappearing_setting(text, uuid) to authenticated;
grant execute on function public.set_chat_disappearing_setting(text, uuid, integer) to authenticated;
grant execute on function public.apply_chat_message_expiry() to authenticated;


create or replace function public.keep_chat_message_expiry_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.expires_at := old.expires_at;
  return new;
end;
$$;

drop trigger if exists direct_messages_expiry_immutable on public.direct_messages;
create trigger direct_messages_expiry_immutable
before update of expires_at on public.direct_messages
for each row execute function public.keep_chat_message_expiry_immutable();

drop trigger if exists chat_group_messages_expiry_immutable on public.chat_group_messages;
create trigger chat_group_messages_expiry_immutable
before update of expires_at on public.chat_group_messages
for each row execute function public.keep_chat_message_expiry_immutable();

revoke all on function public.keep_chat_message_expiry_immutable() from public, anon;
grant execute on function public.keep_chat_message_expiry_immutable() to authenticated;
