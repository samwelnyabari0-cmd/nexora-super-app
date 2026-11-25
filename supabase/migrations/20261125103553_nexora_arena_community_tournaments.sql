-- Nexora Arena community tournament foundation. All entries are free.
create table if not exists public.arena_tournaments (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(trim(title)) between 4 and 80),
 game_key text not null check(game_key in ('efootball','fc_mobile','pubg_mobile','nexora_minigames')),
 platform_key text not null default 'mobile' check(platform_key in ('mobile','console_pc','cross_platform','not_applicable')),
 format_key text not null check(format_key in ('single_elimination','round_robin','battle_royale_points','mini_game_challenge')),
 entry_mode text not null default 'free' check(entry_mode='free'),
 team_size integer not null default 1 check(team_size between 1 and 4),
 max_entries integer not null default 16 check(max_entries between 2 and 128),
 status text not null default 'pending_approval' check(status in ('draft','pending_approval','open','registration_closed','in_progress','completed','cancelled')),
 description text not null default '' check(char_length(description)<=1200),
 rules text not null default '' check(char_length(rules)<=4000),
 starts_at timestamptz, registration_closes_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz, champion_entry_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists arena_tournaments_status_date_idx on public.arena_tournaments(status,starts_at);
create table if not exists public.arena_tournament_teams (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.arena_tournaments(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 50),
 captain_id uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
 unique(tournament_id,name), unique(tournament_id,captain_id)
);
create table if not exists public.arena_tournament_team_members (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.arena_tournament_teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'player' check(role in ('captain','player','substitute')),
 joined_at timestamptz not null default now(), unique(team_id,user_id)
);
create table if not exists public.arena_tournament_entries (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.arena_tournaments(id) on delete cascade,
 player_id uuid references auth.users(id) on delete cascade, team_id uuid references public.arena_tournament_teams(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 2 and 60),
 status text not null default 'registered' check(status in ('registered','checked_in','eliminated','withdrawn','disqualified')),
 seed integer, created_at timestamptz not null default now(),
 check((player_id is not null and team_id is null) or (player_id is null and team_id is not null)),
 unique(tournament_id,player_id), unique(tournament_id,team_id)
);
create table if not exists public.arena_tournament_matches (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.arena_tournaments(id) on delete cascade,
 round_number integer not null check(round_number>0), match_number integer not null check(match_number>0),
 entry_a_id uuid references public.arena_tournament_entries(id) on delete set null,
 entry_b_id uuid references public.arena_tournament_entries(id) on delete set null,
 winner_entry_id uuid references public.arena_tournament_entries(id) on delete set null,
 score_a integer check(score_a is null or score_a>=0), score_b integer check(score_b is null or score_b>=0),
 scheduled_at timestamptz, status text not null default 'scheduled' check(status in ('scheduled','awaiting_result','under_review','completed','disputed','bye','cancelled')),
 next_match_id uuid references public.arena_tournament_matches(id) on delete set null,
 next_slot text check(next_slot is null or next_slot in ('a','b')),
 created_at timestamptz not null default now(), unique(tournament_id,round_number,match_number)
);
create table if not exists public.arena_match_results (
 id uuid primary key default gen_random_uuid(), match_id uuid not null references public.arena_tournament_matches(id) on delete cascade,
 submitted_by uuid not null references auth.users(id) on delete restrict,
 score_a integer not null check(score_a>=0), score_b integer not null check(score_b>=0),
 evidence_path text not null check(char_length(evidence_path) between 3 and 500),
 notes text not null default '' check(char_length(notes)<=600),
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','disputed')),
 reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.arena_tournament_standings (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.arena_tournaments(id) on delete cascade,
 entry_id uuid not null references public.arena_tournament_entries(id) on delete cascade,
 played integer not null default 0 check(played>=0), wins integer not null default 0 check(wins>=0),
 draws integer not null default 0 check(draws>=0), losses integer not null default 0 check(losses>=0),
 points integer not null default 0 check(points>=0), eliminations integer not null default 0 check(eliminations>=0),
 placement_points integer not null default 0 check(placement_points>=0), updated_at timestamptz not null default now(),
 unique(tournament_id,entry_id)
);
create index if not exists arena_entries_tournament_idx on public.arena_tournament_entries(tournament_id,status,created_at);
create index if not exists arena_matches_tournament_round_idx on public.arena_tournament_matches(tournament_id,round_number,match_number);
create index if not exists arena_standings_order_idx on public.arena_tournament_standings(tournament_id,points desc,wins desc,eliminations desc);

alter table public.arena_tournaments enable row level security;
alter table public.arena_tournament_teams enable row level security;
alter table public.arena_tournament_team_members enable row level security;
alter table public.arena_tournament_entries enable row level security;
alter table public.arena_tournament_matches enable row level security;
alter table public.arena_match_results enable row level security;
alter table public.arena_tournament_standings enable row level security;

create or replace function private.is_arena_tournament_manager(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and (exists(select 1 from public.arena_tournaments t where t.id=p_tournament_id and t.created_by=auth.uid()) or public.is_platform_admin(auth.uid())); $$;
revoke all on function private.is_arena_tournament_manager(uuid) from public,anon,authenticated;
grant execute on function private.is_arena_tournament_manager(uuid) to authenticated;

create policy "Arena tournaments are publicly readable" on public.arena_tournaments for select to anon,authenticated using(status in ('open','registration_closed','in_progress','completed') or created_by=(select auth.uid()) or public.my_is_platform_admin());
create policy "Arena tournament creators create tournaments" on public.arena_tournaments for insert to authenticated with check(created_by=(select auth.uid()) and status in ('draft','pending_approval'));
create policy "Arena tournament creators and admins update tournaments" on public.arena_tournaments for update to authenticated using(created_by=(select auth.uid()) or public.my_is_platform_admin()) with check(created_by=(select auth.uid()) or public.my_is_platform_admin());
create policy "Arena tournament teams visible to participants" on public.arena_tournament_teams for select to authenticated using(private.is_arena_tournament_manager(tournament_id) or exists(select 1 from public.arena_tournament_entries e where e.team_id=id and e.player_id=(select auth.uid())));
create policy "Arena team members visible to team" on public.arena_tournament_team_members for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.arena_tournament_teams t where t.id=team_id and (t.captain_id=(select auth.uid()) or private.is_arena_tournament_manager(t.tournament_id))));
create policy "Arena entries visible to tournament community" on public.arena_tournament_entries for select to authenticated using(exists(select 1 from public.arena_tournaments t where t.id=tournament_id and t.status in ('open','registration_closed','in_progress','completed')) or player_id=(select auth.uid()) or private.is_arena_tournament_manager(tournament_id));
create policy "Arena matches visible to participants" on public.arena_tournament_matches for select to authenticated using(private.is_arena_tournament_manager(tournament_id) or exists(select 1 from public.arena_tournament_entries e where e.tournament_id=tournament_id and (e.player_id=(select auth.uid()) or exists(select 1 from public.arena_tournament_team_members tm where tm.team_id=e.team_id and tm.user_id=(select auth.uid())))));
create policy "Arena evidence visible to submitter and organizer" on public.arena_match_results for select to authenticated using(submitted_by=(select auth.uid()) or exists(select 1 from public.arena_tournament_matches m where m.id=match_id and private.is_arena_tournament_manager(m.tournament_id)));
create policy "Arena standings visible to community" on public.arena_tournament_standings for select to authenticated using(exists(select 1 from public.arena_tournaments t where t.id=tournament_id and t.status in ('open','registration_closed','in_progress','completed')) or private.is_arena_tournament_manager(tournament_id));

grant select on public.arena_tournaments to anon,authenticated;
grant select on public.arena_tournament_teams,public.arena_tournament_team_members,public.arena_tournament_entries,public.arena_tournament_matches,public.arena_match_results,public.arena_tournament_standings to authenticated;

create or replace function public.arena_create_tournament(p_title text,p_game_key text,p_platform_key text,p_format_key text,p_team_size integer,p_max_entries integer,p_description text default '',p_rules text default '',p_starts_at timestamptz default null,p_registration_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_admin boolean:=public.my_is_platform_admin(); begin
 if auth.uid() is null then raise exception 'Sign in to create a tournament'; end if;
 if p_game_key not in ('efootball','fc_mobile','pubg_mobile','nexora_minigames') then raise exception 'Unsupported game'; end if;
 if p_format_key not in ('single_elimination','round_robin','battle_royale_points','mini_game_challenge') then raise exception 'Unsupported format'; end if;
 if p_game_key='pubg_mobile' and p_team_size<>4 then raise exception 'PUBG Mobile competitions require four-player squads'; end if;
 if p_game_key in ('efootball','fc_mobile','nexora_minigames') and p_team_size<>1 then raise exception 'This game uses individual entries'; end if;
 if p_max_entries<2 or p_max_entries>128 then raise exception 'Entrant capacity must be between 2 and 128'; end if;
 insert into public.arena_tournaments(title,game_key,platform_key,format_key,team_size,max_entries,status,description,rules,starts_at,registration_closes_at,created_by,approved_by,approved_at)
 values(trim(p_title),p_game_key,p_platform_key,p_format_key,p_team_size,p_max_entries,case when v_admin then 'open' else 'pending_approval' end,coalesce(p_description,''),coalesce(p_rules,''),p_starts_at,p_registration_closes_at,auth.uid(),case when v_admin then auth.uid() end,case when v_admin then now() end) returning id into v_id;
 return v_id; end; $$;
revoke all on function public.arena_create_tournament(text,text,text,text,integer,integer,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.arena_create_tournament(text,text,text,text,integer,integer,text,text,timestamptz,timestamptz) to authenticated;

create or replace function public.arena_approve_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin if not public.my_is_platform_admin() then raise exception 'Nexora administrator approval required'; end if;
 update public.arena_tournaments set status='open',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_tournament_id and status='pending_approval';
 if not found then raise exception 'Tournament is not awaiting approval'; end if; end; $$;
revoke all on function public.arena_approve_tournament(uuid) from public,anon;
grant execute on function public.arena_approve_tournament(uuid) to authenticated;

create or replace function public.arena_register_solo(p_tournament_id uuid,p_display_name text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_t public.arena_tournaments%rowtype; v_count integer; v_id uuid; begin
 if auth.uid() is null then raise exception 'Sign in to register'; end if;
 select * into v_t from public.arena_tournaments where id=p_tournament_id for update;
 if not found or v_t.status<>'open' then raise exception 'Registration is not open'; end if;
 if v_t.team_size<>1 then raise exception 'This tournament requires team registration'; end if;
 if v_t.registration_closes_at is not null and v_t.registration_closes_at<=now() then raise exception 'Registration has closed'; end if;
 select count(*) into v_count from public.arena_tournament_entries where tournament_id=p_tournament_id and status in ('registered','checked_in');
 if v_count>=v_t.max_entries then raise exception 'Tournament is full'; end if;
 insert into public.arena_tournament_entries(tournament_id,player_id,display_name) values(p_tournament_id,auth.uid(),trim(p_display_name)) returning id into v_id; return v_id; end; $$;
revoke all on function public.arena_register_solo(uuid,text) from public,anon;
grant execute on function public.arena_register_solo(uuid,text) to authenticated;

create or replace function public.arena_create_team(p_tournament_id uuid,p_name text,p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_team uuid; v_t public.arena_tournaments%rowtype; v_count integer; begin
 if auth.uid() is null then raise exception 'Sign in to create a squad'; end if;
 select * into v_t from public.arena_tournaments where id=p_tournament_id and status='open' for update;
 if not found then raise exception 'Tournament registration is not open'; end if;
 if v_t.registration_closes_at is not null and v_t.registration_closes_at<=now() then raise exception 'Registration has closed'; end if;
 if v_t.team_size<2 then raise exception 'This tournament uses individual entries'; end if;
 if cardinality(p_member_ids) is null or cardinality(p_member_ids)<>v_t.team_size then raise exception 'Add exactly % players, including yourself',v_t.team_size; end if;
 if not(auth.uid()=any(p_member_ids)) then raise exception 'You must be the team captain'; end if;
 if exists(select 1 from unnest(p_member_ids) x group by x having count(*)>1) then raise exception 'Duplicate team member'; end if;
 if exists(select 1 from public.arena_tournament_team_members tm join public.arena_tournament_teams t on t.id=tm.team_id where t.tournament_id=p_tournament_id and tm.user_id=any(p_member_ids)) then raise exception 'A player is already registered in this tournament'; end if;
 select count(*) into v_count from public.arena_tournament_entries where tournament_id=p_tournament_id and status in ('registered','checked_in');
 if v_count>=v_t.max_entries then raise exception 'Tournament is full'; end if;
 insert into public.arena_tournament_teams(tournament_id,name,captain_id) values(p_tournament_id,trim(p_name),auth.uid()) returning id into v_team;
 insert into public.arena_tournament_team_members(team_id,user_id,role) select v_team,x,case when x=auth.uid() then 'captain' else 'player' end from unnest(p_member_ids) x;
 insert into public.arena_tournament_entries(tournament_id,team_id,display_name) values(p_tournament_id,v_team,trim(p_name)); return v_team; end; $$;
revoke all on function public.arena_create_team(uuid,text,uuid[]) from public,anon;
grant execute on function public.arena_create_team(uuid,text,uuid[]) to authenticated;

create or replace function public.arena_generate_bracket(p_tournament_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$ declare v_t public.arena_tournaments%rowtype; v_entries uuid[]; v_count integer; v_size integer; v_rounds integer; v_round integer; v_matches integer; v_idx integer; v_a uuid; v_b uuid; begin
 if not private.is_arena_tournament_manager(p_tournament_id) then raise exception 'Tournament organizer permission required'; end if;
 select * into v_t from public.arena_tournaments where id=p_tournament_id for update;
 if v_t.status not in ('open','registration_closed') then raise exception 'Tournament cannot start in its current state'; end if;
 select array_agg(id order by random()),count(*) into v_entries,v_count from public.arena_tournament_entries where tournament_id=p_tournament_id and status in ('registered','checked_in');
 if v_count<2 or v_count>v_t.max_entries then raise exception 'At least two valid entries are required'; end if;
 if exists(select 1 from public.arena_tournament_matches where tournament_id=p_tournament_id) then raise exception 'Fixtures have already been generated'; end if;
 if v_t.format_key='battle_royale_points' then
  if v_t.game_key<>'pubg_mobile' or v_t.team_size<>4 then raise exception 'Placement points are reserved for four-player PUBG squads'; end if;
  for v_round in 1..3 loop insert into public.arena_tournament_matches(tournament_id,round_number,match_number,status) values(p_tournament_id,v_round,1,'scheduled'); end loop;
  update public.arena_tournaments set status='in_progress',updated_at=now() where id=p_tournament_id; return v_count;
 end if;
 if v_t.format_key not in ('single_elimination','mini_game_challenge') then raise exception 'Choose a supported knockout or PUBG placement format'; end if;
 v_size:=power(2,ceil(log(2,v_count)))::integer; v_rounds:=ceil(log(2,v_size))::integer;
 for v_round in 1..v_rounds loop v_matches:=v_size/power(2,v_round)::integer; for v_idx in 1..v_matches loop
 v_a:=null; v_b:=null; if v_round=1 then v_a:=v_entries[(v_idx-1)*2+1]; v_b:=v_entries[(v_idx-1)*2+2]; end if;
 insert into public.arena_tournament_matches(tournament_id,round_number,match_number,entry_a_id,entry_b_id,status) values(p_tournament_id,v_round,v_idx,v_a,v_b,case when v_round=1 and v_b is null then 'bye' else 'scheduled' end);
 end loop; end loop;
 update public.arena_tournament_matches m set next_match_id=n.id,next_slot=case when mod(m.match_number,2)=1 then 'a' else 'b' end from public.arena_tournament_matches n
 where m.tournament_id=p_tournament_id and n.tournament_id=p_tournament_id and n.round_number=m.round_number+1 and n.match_number=ceil(m.match_number::numeric/2);
 update public.arena_tournament_matches set winner_entry_id=entry_a_id,status='completed' where tournament_id=p_tournament_id and round_number=1 and status='bye' and entry_a_id is not null;
 update public.arena_tournament_matches m set entry_a_id=case when m.next_slot='a' then m.winner_entry_id else m.entry_a_id end,entry_b_id=case when m.next_slot='b' then m.winner_entry_id else m.entry_b_id end where m.tournament_id=p_tournament_id and m.status='completed' and m.round_number=1 and m.next_match_id is not null;
 update public.arena_tournaments set status='in_progress',updated_at=now() where id=p_tournament_id; return v_count; end; $$;
revoke all on function public.arena_generate_bracket(uuid) from public,anon;
grant execute on function public.arena_generate_bracket(uuid) to authenticated;

create or replace function public.arena_submit_match_result(p_match_id uuid,p_score_a integer,p_score_b integer,p_evidence_path text,p_notes text default '')
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_m public.arena_tournament_matches%rowtype; v_a public.arena_tournament_entries%rowtype; v_b public.arena_tournament_entries%rowtype; v_result uuid; begin
 if auth.uid() is null then raise exception 'Sign in to submit a result'; end if;
 select * into v_m from public.arena_tournament_matches where id=p_match_id and status in ('scheduled','awaiting_result','disputed') for update;
 if not found then raise exception 'This match is not accepting results'; end if;
 select * into v_a from public.arena_tournament_entries where id=v_m.entry_a_id;
 select * into v_b from public.arena_tournament_entries where id=v_m.entry_b_id;
 if not(v_a.player_id=auth.uid() or v_b.player_id=auth.uid() or exists(select 1 from public.arena_tournament_team_members tm where tm.user_id=auth.uid() and tm.team_id in(v_a.team_id,v_b.team_id))) then raise exception 'Only match participants can submit results'; end if;
 if p_score_a<0 or p_score_b<0 or p_score_a=p_score_b then raise exception 'Enter a valid result with a winner'; end if;
 insert into public.arena_match_results(match_id,submitted_by,score_a,score_b,evidence_path,notes) values(p_match_id,auth.uid(),p_score_a,p_score_b,trim(p_evidence_path),coalesce(p_notes,'')) returning id into v_result;
 update public.arena_tournament_matches set status='under_review' where id=p_match_id; return v_result; end; $$;
revoke all on function public.arena_submit_match_result(uuid,integer,integer,text,text) from public,anon;
grant execute on function public.arena_submit_match_result(uuid,integer,integer,text,text) to authenticated;

create or replace function public.arena_review_match_result(p_result_id uuid,p_decision text)
returns void language plpgsql security definer set search_path=''
as $$ declare v_r public.arena_match_results%rowtype; v_m public.arena_tournament_matches%rowtype; v_winner uuid; begin
 select * into v_r from public.arena_match_results where id=p_result_id for update; if not found then raise exception 'Result not found'; end if;
 select * into v_m from public.arena_tournament_matches where id=v_r.match_id for update;
 if not private.is_arena_tournament_manager(v_m.tournament_id) then raise exception 'Organizer verification required'; end if;
 if p_decision not in('confirm','reject') then raise exception 'Invalid review decision'; end if;
 if p_decision='reject' then update public.arena_match_results set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=p_result_id; update public.arena_tournament_matches set status='disputed' where id=v_m.id; return; end if;
 v_winner:=case when v_r.score_a>v_r.score_b then v_m.entry_a_id else v_m.entry_b_id end;
 update public.arena_match_results set status='confirmed',reviewed_by=auth.uid(),reviewed_at=now() where id=p_result_id;
 update public.arena_tournament_matches set score_a=v_r.score_a,score_b=v_r.score_b,winner_entry_id=v_winner,status='completed' where id=v_m.id;
 if v_m.next_match_id is not null then update public.arena_tournament_matches set entry_a_id=case when v_m.next_slot='a' then v_winner else entry_a_id end,entry_b_id=case when v_m.next_slot='b' then v_winner else entry_b_id end where id=v_m.next_match_id; end if;
 insert into public.arena_tournament_standings(tournament_id,entry_id,played,wins,points) values
 (v_m.tournament_id,v_m.entry_a_id,1,case when v_winner=v_m.entry_a_id then 1 else 0 end,case when v_winner=v_m.entry_a_id then 3 else 0 end),
 (v_m.tournament_id,v_m.entry_b_id,1,case when v_winner=v_m.entry_b_id then 1 else 0 end,case when v_winner=v_m.entry_b_id then 3 else 0 end)
 on conflict(tournament_id,entry_id) do update set played=arena_tournament_standings.played+1,wins=arena_tournament_standings.wins+excluded.wins,losses=arena_tournament_standings.losses+(1-excluded.wins),points=arena_tournament_standings.points+excluded.points,updated_at=now();
 if v_m.next_match_id is null then update public.arena_tournaments set status='completed',champion_entry_id=v_winner,updated_at=now() where id=v_m.tournament_id; end if; end; $$;
revoke all on function public.arena_review_match_result(uuid,text) from public,anon;
grant execute on function public.arena_review_match_result(uuid,text) to authenticated;

create or replace function public.arena_update_pubg_points(p_match_id uuid,p_entry_id uuid,p_placement integer,p_eliminations integer)
returns void language plpgsql security definer set search_path=''
as $$ declare v_t uuid; v_points integer; begin
 select tournament_id into v_t from public.arena_tournament_matches where id=p_match_id;
 if not private.is_arena_tournament_manager(v_t) then raise exception 'Organizer permission required'; end if;
 if not exists(select 1 from public.arena_tournament_entries e join public.arena_tournaments t on t.id=e.tournament_id where e.id=p_entry_id and e.tournament_id=v_t and t.game_key='pubg_mobile' and t.team_size=4) then raise exception 'Select a registered PUBG squad'; end if;
 if p_placement<1 or p_placement>128 or p_eliminations<0 or p_eliminations>100 then raise exception 'Invalid PUBG score'; end if;
 v_points:=greatest(0,101-p_placement)+p_eliminations;
 insert into public.arena_tournament_standings(tournament_id,entry_id,played,eliminations,placement_points,points) values(v_t,p_entry_id,1,p_eliminations,greatest(0,101-p_placement),v_points)
 on conflict(tournament_id,entry_id) do update set played=arena_tournament_standings.played+1,eliminations=arena_tournament_standings.eliminations+excluded.eliminations,placement_points=arena_tournament_standings.placement_points+excluded.placement_points,points=arena_tournament_standings.points+excluded.points,updated_at=now(); end; $$;
revoke all on function public.arena_update_pubg_points(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.arena_update_pubg_points(uuid,uuid,integer,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('arena-match-evidence','arena-match-evidence',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Arena participants upload match evidence" on storage.objects for insert to authenticated with check(bucket_id='arena-match-evidence' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and (storage.foldername(name))[2]=(select auth.uid())::text and exists(select 1 from public.arena_tournament_matches m join public.arena_tournament_entries a on a.id=m.entry_a_id left join public.arena_tournament_entries b on b.id=m.entry_b_id where m.id=((storage.foldername(name))[1])::uuid and (a.player_id=(select auth.uid()) or b.player_id=(select auth.uid()) or exists(select 1 from public.arena_tournament_team_members tm where tm.user_id=(select auth.uid()) and tm.team_id in(a.team_id,b.team_id)))));
create policy "Arena evidence visible to submitter and organizer" on storage.objects for select to authenticated using(bucket_id='arena-match-evidence' and ((storage.foldername(name))[2]=(select auth.uid())::text or exists(select 1 from public.arena_tournament_matches m where m.id=((storage.foldername(name))[1])::uuid and private.is_arena_tournament_manager(m.tournament_id))));

-- Do not expose state transitions through direct table writes; all mutations use guarded RPCs.
revoke update on public.arena_tournaments from authenticated;
revoke insert,update,delete on public.arena_tournament_teams from authenticated;
revoke insert,update,delete on public.arena_tournament_team_members from authenticated;
revoke insert,update on public.arena_tournament_entries from authenticated;
revoke update on public.arena_tournament_matches from authenticated;
revoke insert,update on public.arena_match_results from authenticated;
grant select on public.arena_tournaments to anon,authenticated;
grant select on public.arena_tournament_teams,public.arena_tournament_team_members,public.arena_tournament_entries,public.arena_tournament_matches,public.arena_match_results,public.arena_tournament_standings to authenticated;
