-- User-owned public/private clubs and provider-neutral football cache.
-- Existing club rows and all dependent data are preserved.

alter table public.clubs
  add column if not exists owner_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists visibility text not null default 'public';

update public.clubs c
set owner_user_id = (
  select m.user_id
  from public.club_memberships m
  where m.club_id = c.id and m.role = 'creator' and m.status = 'active'
  order by m.created_at asc
  limit 1
)
where c.owner_user_id is null;

-- Do not silently assign ownership to a guessed account. Fail migration if any
-- legacy club lacks its creator membership so the owner can be reconciled first.
do $$
begin
  if exists (select 1 from public.clubs where owner_user_id is null) then
    raise exception 'Cannot backfill club owner: one or more existing clubs have no active creator membership';
  end if;
end;
$$;

alter table public.clubs alter column owner_user_id set not null;
alter table public.clubs drop constraint if exists clubs_visibility_check;
alter table public.clubs add constraint clubs_visibility_check check (visibility in ('public','private'));
create index if not exists clubs_owner_user_id_idx on public.clubs(owner_user_id);

create or replace function private.prevent_club_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_user_id is distinct from new.owner_user_id then
    raise exception 'Club ownership is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_owner_immutable on public.clubs;
create trigger clubs_owner_immutable
before update of owner_user_id on public.clubs
for each row execute function private.prevent_club_owner_change();

create table if not exists public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs(id) on delete restrict,
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists club_invitations_club_status_idx on public.club_invitations(club_id,status);
alter table public.club_invitations enable row level security;
drop policy if exists "Club managers read invitations" on public.club_invitations;
create policy "Club managers read invitations" on public.club_invitations
  for select to authenticated using (private.is_club_admin(club_id));
revoke all on public.club_invitations from anon, authenticated;
grant select on public.club_invitations to authenticated;

create or replace function public.create_club(
  p_name text,
  p_kind text,
  p_city text,
  p_venue text,
  p_blurb text,
  p_visibility text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_club_id text := 'club_' || replace(gen_random_uuid()::text, '-', '');
begin
  if v_user_id is null then raise exception 'Sign in to create a club'; end if;
  if length(trim(coalesce(p_name,''))) not between 3 and 60 then raise exception 'Club name must be 3 to 60 characters'; end if;
  if p_kind not in ('football','gaming','tech') then raise exception 'Choose a valid club category'; end if;
  if p_visibility not in ('public','private') then raise exception 'Choose public or private visibility'; end if;
  if length(trim(coalesce(p_city,''))) > 80 or length(trim(coalesce(p_venue,''))) > 120 or length(trim(coalesce(p_blurb,''))) > 240 then
    raise exception 'Club location or description is too long';
  end if;

  insert into public.clubs(id,name,kind,city,venue,blurb,owner_user_id,visibility)
  values (v_club_id,trim(p_name),p_kind,coalesce(nullif(trim(p_city),''),'Online'),coalesce(nullif(trim(p_venue),''),'Online'),coalesce(trim(p_blurb),''),v_user_id,p_visibility);

  insert into public.club_memberships(club_id,user_id,role,status,appointed_by)
  values (v_club_id,v_user_id,'creator','active',v_user_id);

  insert into public.club_membership_activity(club_id,actor_user_id,target_user_id,event_type,details)
  values (v_club_id,v_user_id,v_user_id,'club_created',jsonb_build_object('visibility',p_visibility));

  return v_club_id;
end;
$$;
revoke all on function public.create_club(text,text,text,text,text,text) from public, anon;
grant execute on function public.create_club(text,text,text,text,text,text) to authenticated;

create or replace function public.create_club_invitation(p_club_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token uuid;
begin
  if v_user_id is null then raise exception 'Sign in to invite members'; end if;
  if not private.is_club_admin(p_club_id) then raise exception 'Club admin permission required'; end if;
  insert into public.club_invitations(club_id,invited_by)
  values (p_club_id,v_user_id)
  returning token into v_token;
  insert into public.club_membership_activity(club_id,actor_user_id,event_type,details)
  values (p_club_id,v_user_id,'invitation_created','{}'::jsonb);
  return v_token;
end;
$$;
revoke all on function public.create_club_invitation(text) from public, anon;
grant execute on function public.create_club_invitation(text) to authenticated;

create or replace function public.accept_club_invitation(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_club_id text;
  v_existing_status text;
begin
  if v_user_id is null then raise exception 'Sign in to accept this invitation'; end if;
  select i.club_id into v_club_id
  from public.club_invitations i
  where i.token=p_token and i.status='pending' and i.expires_at > now()
  for update;
  if v_club_id is null then raise exception 'This invitation is invalid or has expired'; end if;

  select m.status into v_existing_status
  from public.club_memberships m where m.club_id=v_club_id and m.user_id=v_user_id;
  if v_existing_status='banned' then raise exception 'You cannot join this club'; end if;

  if v_existing_status is null then
    insert into public.club_memberships(club_id,user_id,role,status,appointed_by)
    values (v_club_id,v_user_id,'member','active',v_user_id)
    on conflict (club_id,user_id) do nothing;
  elsif v_existing_status='pending' then
    update public.club_memberships set status='active' where club_id=v_club_id and user_id=v_user_id;
  end if;

  update public.club_invitations
  set status='accepted', accepted_by=v_user_id, accepted_at=now()
  where token=p_token;

  insert into public.club_membership_activity(club_id,actor_user_id,target_user_id,event_type,details)
  values (v_club_id,v_user_id,v_user_id,'invitation_accepted','{}'::jsonb);
  return v_club_id;
end;
$$;
revoke all on function public.accept_club_invitation(uuid) from public, anon;
grant execute on function public.accept_club_invitation(uuid) to authenticated;

-- Replace the permissive legacy directory read policy with visibility-aware RLS.
drop policy if exists "Clubs are visible in directory" on public.clubs;
create policy "Public clubs and private club members can view club details"
  on public.clubs for select to anon, authenticated
  using (visibility='public' or private.is_club_member(id));

-- Existing public join requests remain valid; private clubs require an invitation token.
drop policy if exists "Private clubs require invitations for join requests" on public.club_memberships;
create policy "Private clubs require invitations for join requests"
  on public.club_memberships as restrictive for insert to authenticated
  with check (
    exists (select 1 from public.clubs c where c.id=club_id and c.visibility='public')
    or exists (select 1 from public.club_invitations i where i.club_id=public.club_memberships.club_id and i.accepted_by=(select auth.uid()) and i.status='accepted')
  );

-- Do not expose private club event details through the legacy authenticated SELECT policy.
drop policy if exists "Private club events require membership" on public.club_events;
create policy "Private club events require membership"
  on public.club_events as restrictive for select to authenticated
  using (
    exists (select 1 from public.clubs c where c.id=club_id and c.visibility='public')
    or private.is_club_member(club_id)
  );

-- Preserve the old RPC contract's fields and append visibility for the new directory UI.
drop function if exists public.get_club_directory();
create function public.get_club_directory()
returns table (
  id text,name text,kind text,city text,venue text,blurb text,
  latitude double precision,longitude double precision,active_member_count bigint,visibility text,
  my_role text,my_status text
)
language sql stable security definer set search_path=''
as $$
  select c.id,c.name,c.kind,c.city,c.venue,c.blurb,c.latitude,c.longitude,
    (select count(*) from public.club_memberships m where m.club_id=c.id and m.status='active'),
    c.visibility, own.role, own.status
  from public.clubs c
  left join public.club_memberships own on own.club_id=c.id and own.user_id=(select auth.uid())
  where c.visibility='public' or private.is_club_member(c.id)
  order by c.name;
$$;
revoke all on function public.get_club_directory() from public;
grant execute on function public.get_club_directory() to anon,authenticated;

-- Football cache tables. Browser roles can read published rows but cannot ingest or mutate them.
create table if not exists public.football_matches (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  competition_code text not null,
  competition_name text not null,
  home_team text not null,
  away_team text not null,
  home_team_provider_id text,
  away_team_provider_id text,
  home_score integer,
  away_score integer,
  status text not null check (status in ('SCHEDULED','LIVE','HT','FT','POSTPONED','CANCELLED','ABANDONED')),
  elapsed_minute integer,
  kickoff_at timestamptz not null,
  source_url text,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(provider,provider_id)
);
create index if not exists football_matches_kickoff_idx on public.football_matches(kickoff_at desc);
create index if not exists football_matches_status_idx on public.football_matches(status,updated_at desc);
alter table public.football_matches enable row level security;
drop policy if exists "Published football matches are readable" on public.football_matches;
create policy "Published football matches are readable" on public.football_matches for select to anon,authenticated using (is_published);
grant select on public.football_matches to anon,authenticated;
grant all on public.football_matches to service_role;

create table if not exists public.football_announcements (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  source_name text not null,
  headline text not null,
  summary text not null default '',
  source_url text not null,
  published_at timestamptz not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique(provider,provider_id)
);
create index if not exists football_announcements_published_idx on public.football_announcements(published_at desc);
alter table public.football_announcements enable row level security;
drop policy if exists "Published football announcements are readable" on public.football_announcements;
create policy "Published football announcements are readable" on public.football_announcements for select to anon,authenticated using (is_published);
grant select on public.football_announcements to anon,authenticated;
grant all on public.football_announcements to service_role;

create table if not exists public.football_highlights (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  competition_code text,
  match_label text not null,
  score_label text,
  duration_seconds integer,
  thumbnail_url text,
  video_url text not null,
  source_name text not null,
  published_at timestamptz not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique(provider,provider_id)
);
create index if not exists football_highlights_published_idx on public.football_highlights(published_at desc);
alter table public.football_highlights enable row level security;
drop policy if exists "Published football highlights are readable" on public.football_highlights;
create policy "Published football highlights are readable" on public.football_highlights for select to anon,authenticated using (is_published);
grant select on public.football_highlights to anon,authenticated;
grant all on public.football_highlights to service_role;

create table if not exists public.football_favorite_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  team_provider_id text not null,
  team_name text not null,
  created_at timestamptz not null default now(),
  unique(user_id,provider,team_provider_id)
);
create index if not exists football_favorite_teams_user_idx on public.football_favorite_teams(user_id);
alter table public.football_favorite_teams enable row level security;
create policy "Users manage their favorite football teams" on public.football_favorite_teams
  for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select,insert,update,delete on public.football_favorite_teams to authenticated;

create table if not exists public.football_club_team_sync (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  team_provider_id text not null,
  team_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(club_id,provider,team_provider_id)
);
create index if not exists football_club_team_sync_club_idx on public.football_club_team_sync(club_id,enabled);
alter table public.football_club_team_sync enable row level security;
create policy "Club members can view football sync settings" on public.football_club_team_sync
  for select to authenticated using (private.is_club_member(club_id));
create policy "Club admins manage football sync settings" on public.football_club_team_sync
  for all to authenticated using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id) and created_by=(select auth.uid()));
grant select,insert,update,delete on public.football_club_team_sync to authenticated;


-- One row per club/match tracks the last score signature that was auto-shared.
create table if not exists public.football_club_match_posts (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs(id) on delete cascade,
  provider text not null,
  provider_id text not null,
  score_signature text not null,
  posted_at timestamptz not null default now(),
  unique(club_id,provider,provider_id)
);
alter table public.football_club_match_posts enable row level security;
create policy "Club members can view auto-shared match records" on public.football_club_match_posts
  for select to authenticated using (private.is_club_member(club_id));
grant select on public.football_club_match_posts to authenticated;
grant all on public.football_club_match_posts to service_role;


-- Minimal server-only state used to keep fixture discovery to a few calls per day.
create table if not exists public.football_sync_state (
  key text primary key,
  last_synced_at timestamptz not null
);
alter table public.football_sync_state enable row level security;
grant all on public.football_sync_state to service_role;

create or replace function public.share_football_match_update(
  p_club_id text,
  p_provider text,
  p_provider_id text,
  p_team_provider_id text,
  p_score_signature text,
  p_sender_id uuid,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_signature text;
begin
  if length(coalesce(p_message,'')) not between 1 and 2000 then
    raise exception 'Invalid football update message';
  end if;
  if not exists (
    select 1 from public.football_club_team_sync s
    join public.club_memberships m on m.club_id=s.club_id and m.user_id=s.created_by
    where s.club_id=p_club_id and s.team_provider_id=p_team_provider_id
      and s.enabled=true and s.created_by=p_sender_id
      and m.status='active' and m.role in ('creator','admin')
  ) then
    update public.football_club_team_sync set enabled=false
    where club_id=p_club_id and team_provider_id=p_team_provider_id and created_by=p_sender_id;
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_club_id || ':' || p_provider || ':' || p_provider_id)::bigint);
  select score_signature into v_previous_signature
  from public.football_club_match_posts
  where club_id=p_club_id and provider=p_provider and provider_id=p_provider_id
  for update;

  if v_previous_signature is not distinct from p_score_signature then return false; end if;

  insert into public.football_club_match_posts(club_id,provider,provider_id,score_signature,posted_at)
  values (p_club_id,p_provider,p_provider_id,p_score_signature,now())
  on conflict (club_id,provider,provider_id)
  do update set score_signature=excluded.score_signature,posted_at=excluded.posted_at;

  insert into public.club_messages(club_id,sender_id,sender_name,body,is_announcement)
  values (p_club_id,p_sender_id,'Nexora Football',p_message,false);

  return true;
end;
$$;
revoke all on function public.share_football_match_update(text,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.share_football_match_update(text,text,text,text,text,uuid,text) to service_role;
