-- Club channel announcements, pinned notices and per-member unread tracking.
alter table public.club_messages add column if not exists is_announcement boolean not null default false, add column if not exists pinned_at timestamptz;
create index if not exists club_messages_pinned_idx on public.club_messages(club_id,pinned_at desc) where pinned_at is not null;

create or replace function private.set_club_message_author()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_name text;
begin
  select coalesce(nullif(p.display_name,''),nullif(p.handle,''),'Nexora member') into v_name from public.profiles p where p.id=new.sender_id;
  new.sender_name := coalesce(v_name,'Nexora member');
  if new.sender_id <> (select auth.uid()) then raise exception 'Message sender must match the signed-in user'; end if;
  if new.is_announcement and not private.can_manage_club_events(new.club_id) then raise exception 'Only club managers can post announcements'; end if;
  return new;
end;
$$;
drop trigger if exists club_messages_author_trigger on public.club_messages;
create trigger club_messages_author_trigger before insert on public.club_messages for each row execute function private.set_club_message_author();

drop policy if exists "Active members send channel messages" on public.club_messages;
create policy "Active members send channel messages" on public.club_messages for insert to authenticated with check (sender_id=(select auth.uid()) and private.is_club_member(club_id) and (not is_announcement or private.can_manage_club_events(club_id)));

create table if not exists public.club_channel_reads (
  club_id text not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (club_id,user_id)
);
alter table public.club_channel_reads enable row level security;
drop policy if exists "Members read own club channel receipts" on public.club_channel_reads;
create policy "Members read own club channel receipts" on public.club_channel_reads for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Members create own club channel receipts" on public.club_channel_reads;
create policy "Members create own club channel receipts" on public.club_channel_reads for insert to authenticated with check (user_id=(select auth.uid()) and private.is_club_member(club_id));
drop policy if exists "Members update own club channel receipts" on public.club_channel_reads;
create policy "Members update own club channel receipts" on public.club_channel_reads for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and private.is_club_member(club_id));

create or replace function public.mark_club_channel_read(p_club_id text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not private.is_club_member(p_club_id) then raise exception 'Active club membership required'; end if;
  insert into public.club_channel_reads(club_id,user_id,last_read_at) values(p_club_id,(select auth.uid()),now())
  on conflict (club_id,user_id) do update set last_read_at=excluded.last_read_at;
end;
$$;
grant execute on function public.mark_club_channel_read(text) to authenticated;

create or replace function public.get_club_unread_counts()
returns table(club_id text, unread_count bigint)
language sql stable security definer set search_path=''
as $$
  select m.club_id,count(msg.id) as unread_count
  from public.club_memberships m
  left join public.club_channel_reads r on r.club_id=m.club_id and r.user_id=m.user_id
  left join public.club_messages msg on msg.club_id=m.club_id and msg.sender_id <> (select auth.uid()) and msg.created_at > coalesce(r.last_read_at,m.created_at)
  where m.user_id=(select auth.uid()) and m.status='active'
  group by m.club_id;
$$;
grant execute on function public.get_club_unread_counts() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='club_channel_reads') then
    alter publication supabase_realtime add table public.club_channel_reads;
  end if;
end $$;
