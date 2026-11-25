create table if not exists public.arena_pubg_round_scores (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references public.arena_tournament_matches(id) on delete cascade,
 entry_id uuid not null references public.arena_tournament_entries(id) on delete cascade,
 placement integer not null check(placement between 1 and 128),
 eliminations integer not null check(eliminations between 0 and 100),
 points integer not null check(points>=0),
 recorded_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(match_id,entry_id)
);
alter table public.arena_pubg_round_scores enable row level security;
create policy "Arena PUBG round scores visible to organizers" on public.arena_pubg_round_scores for select to authenticated using(exists(select 1 from public.arena_tournament_matches m where m.id=match_id and private.is_arena_tournament_manager(m.tournament_id)));
grant select on public.arena_pubg_round_scores to authenticated;
create or replace function public.arena_update_pubg_points(p_match_id uuid,p_entry_id uuid,p_placement integer,p_eliminations integer)
returns void language plpgsql security definer set search_path=''
as $$
declare v_t uuid; v_points integer;
begin
 select m.tournament_id into v_t from public.arena_tournament_matches m where m.id=p_match_id and m.status='scheduled';
 if not private.is_arena_tournament_manager(v_t) then raise exception 'Organizer permission required'; end if;
 if not exists(select 1 from public.arena_tournament_entries e join public.arena_tournaments t on t.id=e.tournament_id where e.id=p_entry_id and e.tournament_id=v_t and t.game_key='pubg_mobile' and t.team_size=4) then raise exception 'Select a registered PUBG squad'; end if;
 if p_placement<1 or p_placement>128 or p_eliminations<0 or p_eliminations>100 then raise exception 'Invalid PUBG score'; end if;
 v_points:=greatest(0,101-p_placement)+p_eliminations;
 insert into public.arena_pubg_round_scores(match_id,entry_id,placement,eliminations,points,recorded_by)
 values(p_match_id,p_entry_id,p_placement,p_eliminations,v_points,auth.uid())
 on conflict(match_id,entry_id) do update set placement=excluded.placement,eliminations=excluded.eliminations,points=excluded.points,recorded_by=excluded.recorded_by,updated_at=now();
 insert into public.arena_tournament_standings(tournament_id,entry_id,played,eliminations,placement_points,points)
 select v_t,p_entry_id,count(*)::integer,sum(s.eliminations)::integer,sum(greatest(0,101-s.placement))::integer,sum(s.points)::integer
 from public.arena_pubg_round_scores s join public.arena_tournament_matches m on m.id=s.match_id
 where m.tournament_id=v_t and s.entry_id=p_entry_id
 on conflict(tournament_id,entry_id) do update set played=excluded.played,eliminations=excluded.eliminations,placement_points=excluded.placement_points,points=excluded.points,updated_at=now();
end; $$;
revoke all on function public.arena_update_pubg_points(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.arena_update_pubg_points(uuid,uuid,integer,integer) to authenticated;
