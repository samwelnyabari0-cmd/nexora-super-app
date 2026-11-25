-- Exclusive in-game football club picks for Nexora Arena knockout cups.
alter table public.arena_tournament_entries
  add column if not exists selected_club_name text;

create unique index if not exists arena_one_player_per_club_per_tournament
  on public.arena_tournament_entries (tournament_id, lower(selected_club_name))
  where selected_club_name is not null;

drop function if exists public.arena_register_solo(uuid,text);

create or replace function public.arena_register_solo(
  p_tournament_id uuid,
  p_display_name text,
  p_club_name text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_t public.arena_tournaments%rowtype;
  v_count integer;
  v_id uuid;
  v_club text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to register';
  end if;

  select * into v_t
  from public.arena_tournaments
  where id=p_tournament_id
  for update;

  if not found or v_t.status<>'open' then
    raise exception 'Registration is not open';
  end if;
  if v_t.team_size<>1 then
    raise exception 'This tournament requires team registration';
  end if;
  if v_t.registration_closes_at is not null and v_t.registration_closes_at<=now() then
    raise exception 'Registration has closed';
  end if;

  if v_t.game_key in ('efootball','fc_mobile') then
    v_club := nullif(trim(coalesce(p_club_name,'')),'');
    if v_club is null then
      raise exception 'Choose an in-game football club before registering';
    end if;
    if v_club not in (
      'Arsenal','Aston Villa','Atalanta','Atletico Madrid','Barcelona',
      'Bayern Munich','Borussia Dortmund','Chelsea','Inter Milan','Juventus',
      'Liverpool','Manchester City','Manchester United','AC Milan','Napoli',
      'Newcastle United','Paris Saint-Germain','Real Madrid','Roma','Tottenham Hotspur'
    ) then
      raise exception 'That club is not in the supported tournament club list';
    end if;
    if exists (
      select 1 from public.arena_tournament_entries e
      where e.tournament_id=p_tournament_id
        and lower(e.selected_club_name)=lower(v_club)
    ) then
      raise exception 'That club has already been selected by another player';
    end if;
  else
    if nullif(trim(coalesce(p_club_name,'')),'') is not null then
      raise exception 'Club selection is only used for eFootball and FC Mobile';
    end if;
    v_club := null;
  end if;

  select count(*) into v_count
  from public.arena_tournament_entries
  where tournament_id=p_tournament_id and status in ('registered','checked_in');
  if v_count>=v_t.max_entries then
    raise exception 'Tournament is full';
  end if;

  insert into public.arena_tournament_entries(
    tournament_id,player_id,display_name,selected_club_name
  ) values (
    p_tournament_id,auth.uid(),trim(p_display_name),v_club
  ) returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'That club or player is already registered in this tournament';
end;
$$;

revoke all on function public.arena_register_solo(uuid,text,text) from public,anon;
grant execute on function public.arena_register_solo(uuid,text,text) to authenticated;

comment on column public.arena_tournament_entries.selected_club_name is
  'Unique in-game club pick for one-player eFootball and FC Mobile tournament entries.';
