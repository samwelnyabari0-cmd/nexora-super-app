-- Clubs & Guilds: shared directory, member-safe administration and RSVPs.
-- This migration intentionally does not create or modify any payment flow.
create table if not exists public.clubs (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('football','gaming','tech')),
  city text not null,
  venue text not null,
  blurb text not null default '',
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clubs enable row level security;
drop policy if exists "Clubs are visible in directory" on public.clubs;
create policy "Clubs are visible in directory" on public.clubs for select to anon, authenticated using (true);
drop policy if exists "Club creators manage club details" on public.clubs;
create policy "Club creators manage club details" on public.clubs for update to authenticated using (private.is_club_creator(id)) with check (private.is_club_creator(id));

insert into public.clubs (id,name,kind,city,venue,blurb) values
('g1','Nairobi Football Casuals','football','Nairobi','Goan Institute Pitch','Sunday-league side. Organise fixtures, training and match-day updates.'),
('g2','Machakos Uni Tech Club','tech','Machakos','Machakos University Lab 2','Student builders running weekly build nights and hackathons.'),
('g3','GDevelop Game Devs','gaming','Nairobi','iHub Co-work','Indie game creators sharing jams, playtests and meetups.')
on conflict (id) do update set name=excluded.name,kind=excluded.kind,city=excluded.city,venue=excluded.venue,blurb=excluded.blurb,updated_at=now();

alter table public.club_memberships drop constraint if exists club_memberships_role_check;
alter table public.club_memberships add constraint club_memberships_role_check check (role in ('creator','admin','moderator','member'));

create or replace function private.is_club_member(p_club_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists (select 1 from public.club_memberships m where m.club_id=p_club_id and m.user_id=(select auth.uid()) and m.status='active'); $$;

create or replace function private.can_manage_club_events(p_club_id text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists (select 1 from public.club_memberships m where m.club_id=p_club_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('creator','admin','moderator')); $$;

create or replace function public.get_club_directory()
returns table (id text,name text,kind text,city text,venue text,blurb text,latitude double precision,longitude double precision,active_member_count bigint)
language sql stable security definer set search_path=''
as $$
 select c.id,c.name,c.kind,c.city,c.venue,c.blurb,c.latitude,c.longitude,
 (select count(*) from public.club_memberships m where m.club_id=c.id and m.status='active')
 from public.clubs c order by c.name;
$$;
grant execute on function public.get_club_directory() to anon,authenticated;

alter table public.club_events add column if not exists notes text not null default '';

create table if not exists public.event_rsvps (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.club_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check (status in ('going','maybe','cant_make_it')),
 updated_at timestamptz not null default now(),
 constraint event_rsvps_event_user_key unique(event_id,user_id)
);
create index if not exists event_rsvps_event_status_idx on public.event_rsvps(event_id,status);
alter table public.event_rsvps enable row level security;
drop policy if exists "Club members can view event RSVPs" on public.event_rsvps;
create policy "Club members can view event RSVPs" on public.event_rsvps for select to authenticated using (exists (select 1 from public.club_events e where e.id=event_rsvps.event_id and private.is_club_member(e.club_id)));
drop policy if exists "Members manage their own event RSVP" on public.event_rsvps;
create policy "Members manage their own event RSVP" on public.event_rsvps for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from public.club_events e where e.id=event_rsvps.event_id and private.is_club_member(e.club_id)));
drop policy if exists "Members update their own event RSVP" on public.event_rsvps;
create policy "Members update their own event RSVP" on public.event_rsvps for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and exists (select 1 from public.club_events e where e.id=event_rsvps.event_id and private.is_club_member(e.club_id)));
drop policy if exists "Members remove their own event RSVP" on public.event_rsvps;
create policy "Members remove their own event RSVP" on public.event_rsvps for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists "Club membership visible to self or admins" on public.club_memberships;
create policy "Club membership visible to members" on public.club_memberships for select to authenticated using (user_id=(select auth.uid()) or private.is_club_member(club_id));

drop policy if exists "Creator and admins manage member records" on public.club_memberships;
create policy "Creator and admins manage member records" on public.club_memberships for update to authenticated
using (user_id <> (select auth.uid()) and role <> 'creator' and (private.is_club_creator(club_id) or (private.is_club_admin(club_id) and role='member')))
with check (role <> 'creator' and (private.is_club_creator(club_id) or (private.is_club_admin(club_id) and role='member')));

create or replace function private.guard_club_membership_changes()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='UPDATE' then
  if old.user_id is distinct from new.user_id or old.club_id is distinct from new.club_id then raise exception 'Membership identity cannot be changed'; end if;
  if old.role='creator' and (new.role <> 'creator' or new.status <> 'active') then raise exception 'Transfer club ownership before changing the creator membership'; end if;
  if old.user_id=(select auth.uid()) and (old.role is distinct from new.role or old.status is distinct from new.status) then raise exception 'You cannot change your own club role or status'; end if;
  return new;
 elsif tg_op='DELETE' then
  if old.role='creator' then raise exception 'Transfer club ownership before removing the creator'; end if;
  return old;
 end if;
 return null;
end;
$$;
drop trigger if exists club_membership_guard_trigger on public.club_memberships;
create trigger club_membership_guard_trigger before update or delete on public.club_memberships for each row execute function private.guard_club_membership_changes();

drop policy if exists "club_messages_select_auth" on public.club_messages;
drop policy if exists "club_messages_insert_own" on public.club_messages;
create policy "Club members read channel messages" on public.club_messages for select to authenticated using (private.is_club_member(club_id));
create policy "Active members send channel messages" on public.club_messages for insert to authenticated with check (sender_id=(select auth.uid()) and private.is_club_member(club_id));

drop policy if exists "club_events_insert_own" on public.club_events;
create policy "Club managers create events" on public.club_events for insert to authenticated with check (created_by=(select auth.uid()) and private.can_manage_club_events(club_id));
drop policy if exists "Club creators and admins update events" on public.club_events;
create policy "Club creators and admins update events" on public.club_events for update to authenticated using (private.is_club_admin(club_id)) with check (private.is_club_admin(club_id));
drop policy if exists "Club creators and admins delete events" on public.club_events;
create policy "Club creators and admins delete events" on public.club_events for delete to authenticated using (private.is_club_admin(club_id));

create or replace function private.log_club_membership_activity()
returns trigger language plpgsql security definer set search_path='pg_catalog','auth'
as $$
declare v_type text; v_club_id text; v_target uuid; v_details jsonb;
begin
 if tg_op='INSERT' then
  v_type:='membership_joined'; v_club_id:=new.club_id; v_target:=new.user_id;
  v_details:=jsonb_build_object('role',new.role,'status',new.status);
 elsif tg_op='UPDATE' then
  v_club_id:=new.club_id; v_target:=new.user_id;
  if old.role is distinct from new.role then v_type:='membership_role_changed';
  elsif old.status is distinct from new.status then
   v_type:=case when new.status='banned' then 'membership_banned' when old.status='banned' then 'membership_restored' else 'membership_status_changed' end;
  else return new; end if;
  v_details:=jsonb_build_object('old_role',old.role,'new_role',new.role,'old_status',old.status,'new_status',new.status);
 else
  v_type:='membership_removed'; v_club_id:=old.club_id; v_target:=old.user_id;
  v_details:=jsonb_build_object('old_role',old.role,'old_status',old.status);
 end if;
 insert into public.club_membership_activity(club_id,actor_user_id,target_user_id,event_type,details) values(v_club_id,auth.uid(),v_target,v_type,v_details);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;

insert into public.club_events(club_id,title,venue,event_date,event_time,kind,created_by,notes)
select f.club_id,f.title,f.venue,f.event_date,f.event_time,f.kind,m.user_id,f.notes
from (values
 ('g1','League opener vs Kariobangi United','Goan Institute Pitch','2026-10-25'::date,'15:00','match',''),
 ('g1','Midweek training','Goan Institute Pitch','2026-11-04'::date,'18:30','training',''),
 ('g1','Sunday league vs Kasarani All-Stars','Goan Institute Pitch','2026-11-08'::date,'15:00','match',''),
 ('g1','Cup quarter-final','City Stadium','2026-11-22'::date,'14:00','match',''),
 ('g2','Weekly build night','Machakos University Lab 2','2026-11-05'::date,'19:00','meetup',''),
 ('g2','Hackathon: Machakos Open','Machakos University Auditorium','2026-11-14'::date,'09:00','tournament',''),
 ('g2','Intro to GitHub Actions','Machakos University Lab 2','2026-10-29'::date,'19:00','meetup',''),
 ('g3','48h game jam kickoff','iHub Co-work','2026-11-06'::date,'18:00','jam',''),
 ('g3','Playtest evening','iHub Co-work','2026-11-12'::date,'18:30','meetup',''),
 ('g3','October jam demo day','iHub Co-work','2026-10-24'::date,'17:00','jam','')
) f(club_id,title,venue,event_date,event_time,kind,notes)
join lateral (select user_id from public.club_memberships where club_id=f.club_id and role='creator' and status='active' order by created_at limit 1) m on true
where not exists (select 1 from public.club_events e where e.club_id=f.club_id and e.title=f.title and e.event_date=f.event_date);
