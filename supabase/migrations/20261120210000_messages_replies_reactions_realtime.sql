-- Replies, reactions, and private ephemeral activity channels for Nexora chat.
-- This migration is committed with the application changes and is not applied to production here.

alter table public.direct_messages
  add column if not exists reply_to_message_id uuid
  references public.direct_messages(id) on delete set null;

alter table public.chat_group_messages
  add column if not exists reply_to_message_id uuid
  references public.chat_group_messages(id) on delete set null;

create index if not exists direct_messages_reply_to_idx
  on public.direct_messages(reply_to_message_id)
  where reply_to_message_id is not null;

create index if not exists chat_group_messages_reply_to_idx
  on public.chat_group_messages(reply_to_message_id)
  where reply_to_message_id is not null;

create table if not exists public.direct_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '👍', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.chat_group_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '👍', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index if not exists direct_message_reactions_message_idx
  on public.direct_message_reactions(message_id);
create index if not exists chat_group_message_reactions_message_idx
  on public.chat_group_message_reactions(message_id);

-- Enable Postgres Changes for reaction updates without changing existing publication members.
do $
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_message_reactions') then
    execute 'alter publication supabase_realtime add table public.direct_message_reactions';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_group_message_reactions') then
    execute 'alter publication supabase_realtime add table public.chat_group_message_reactions';
  end if;
end;
$;

alter table public.direct_message_reactions enable row level security;
alter table public.chat_group_message_reactions enable row level security;

grant select, insert, update, delete on public.direct_message_reactions to authenticated;
grant select, insert, update, delete on public.chat_group_message_reactions to authenticated;

create policy "direct participants can view message reactions"
on public.direct_message_reactions for select to authenticated
using (
  exists (
    select 1 from public.direct_messages m
    where m.id = message_id
      and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
  )
);

create policy "direct participants can add own message reactions"
on public.direct_message_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.direct_messages m
    where m.id = message_id
      and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
  )
);

create policy "users can update own direct message reactions"
on public.direct_message_reactions for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.direct_messages m
    where m.id = message_id
      and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
  )
);

create policy "users can remove own direct message reactions"
on public.direct_message_reactions for delete to authenticated
using (user_id = (select auth.uid()));

create policy "group members can view message reactions"
on public.chat_group_message_reactions for select to authenticated
using (
  exists (
    select 1 from public.chat_group_messages m
    where m.id = message_id
      and private.is_group_member(m.group_id)
  )
);

create policy "group members can add own message reactions"
on public.chat_group_message_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.chat_group_messages m
    where m.id = message_id
      and private.is_group_member(m.group_id)
  )
);

create policy "users can update own group message reactions"
on public.chat_group_message_reactions for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.chat_group_messages m
    where m.id = message_id
      and private.is_group_member(m.group_id)
  )
);

create policy "users can remove own group message reactions"
on public.chat_group_message_reactions for delete to authenticated
using (user_id = (select auth.uid()));

-- Private Realtime channels use dm:<lower-uuid>:<higher-uuid> and group:<uuid>.
-- Only the two direct participants or current group members may read/write activity.
create policy "chat participants can receive private activity broadcasts"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (
    (
      realtime.topic() ~ '^dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (
        split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
        or split_part(realtime.topic(), ':', 3) = (select auth.uid())::text
      )
      and exists (
        select 1 from public.direct_messages m
        where (m.sender_id = (select auth.uid()) and m.recipient_id::text =
          case when split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
            then split_part(realtime.topic(), ':', 3)
            else split_part(realtime.topic(), ':', 2) end)
           or (m.recipient_id = (select auth.uid()) and m.sender_id::text =
          case when split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
            then split_part(realtime.topic(), ':', 3)
            else split_part(realtime.topic(), ':', 2) end)
      )
    )
    or (
      realtime.topic() ~ '^group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_group_member(split_part(realtime.topic(), ':', 2)::uuid)
    )
  )
);

create policy "chat participants can send private activity broadcasts"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (
    (
      realtime.topic() ~ '^dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (
        split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
        or split_part(realtime.topic(), ':', 3) = (select auth.uid())::text
      )
      and exists (
        select 1 from public.direct_messages m
        where (m.sender_id = (select auth.uid()) and m.recipient_id::text =
          case when split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
            then split_part(realtime.topic(), ':', 3)
            else split_part(realtime.topic(), ':', 2) end)
           or (m.recipient_id = (select auth.uid()) and m.sender_id::text =
          case when split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
            then split_part(realtime.topic(), ':', 3)
            else split_part(realtime.topic(), ':', 2) end)
      )
    )
    or (
      realtime.topic() ~ '^group:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_group_member(split_part(realtime.topic(), ':', 2)::uuid)
    )
  )
);
