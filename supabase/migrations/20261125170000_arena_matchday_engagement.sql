-- Nexora Arena: scorer cache, form guide, pre-match prompts and post-match fan polls.
create table if not exists public.football_scorers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  competition_code text not null,
  competition_name text not null,
  season_id text not null,
  player_provider_id text,
  player_name text not null,
  team_provider_id text,
  team_name text not null,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  penalties integer not null default 0 check (penalties >= 0),
  updated_at timestamptz not null default now(),
  constraint football_scorers_provider_competition_season_player_key
    unique (provider, competition_code, season_id, player_name, team_name)
);

create table if not exists public.football_scorer_sync_runs (
  competition_code text primary key,
  attempted_at timestamptz not null,
  season_id text,
  last_error text
);
alter table public.football_scorer_sync_runs enable row level security;
revoke all on table public.football_scorer_sync_runs from public, anon, authenticated;
grant all on table public.football_scorer_sync_runs to service_role;

create index if not exists football_scorers_leaderboard_idx
  on public.football_scorers (competition_code, goals desc, assists desc, player_name);
alter table public.football_scorers enable row level security;
drop policy if exists "Public can read football scorers" on public.football_scorers;
create policy "Public can read football scorers" on public.football_scorers for select to anon, authenticated using (true);
revoke all on table public.football_scorers from public;
grant select on public.football_scorers to anon, authenticated;
grant all on public.football_scorers to service_role;

create or replace function public.get_football_form_guide(p_team_names text[])
returns table(team_name text, match_id uuid, kickoff_at timestamptz, opponent text, result text)
language sql stable security invoker set search_path = public
as $form$
  select requested.team_name, recent.id, recent.kickoff_at,
    case when recent.is_home then recent.away_team else recent.home_team end,
    case when (recent.is_home and recent.home_score > recent.away_score) or (not recent.is_home and recent.away_score > recent.home_score) then 'W'
         when recent.home_score = recent.away_score then 'D' else 'L' end
  from (select distinct trim(input.team_name) as team_name from unnest(coalesce(p_team_names, array[]::text[])) as input(team_name) where trim(input.team_name) <> '') requested
  cross join lateral (
    select m.id, m.kickoff_at, m.home_team, m.away_team, m.home_score, m.away_score,
      lower(trim(m.home_team)) = lower(trim(requested.team_name)) as is_home
    from public.football_matches m
    where m.status = 'FT' and m.home_score is not null and m.away_score is not null
      and (lower(trim(m.home_team)) = lower(trim(requested.team_name)) or lower(trim(m.away_team)) = lower(trim(requested.team_name)))
    order by m.kickoff_at desc limit 5
  ) recent
  order by requested.team_name, recent.kickoff_at asc;
$form$;
grant execute on function public.get_football_form_guide(text[]) to anon, authenticated;

create table if not exists public.football_match_polls (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.football_matches(id) on delete cascade,
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table if not exists public.football_match_fan_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.football_match_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null check (length(trim(player_name)) between 2 and 80),
  rating integer not null check (rating between 1 and 10),
  tactical_take text not null check (length(trim(tactical_take)) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists football_match_fan_votes_poll_idx on public.football_match_fan_votes(poll_id, created_at);
alter table public.football_match_polls enable row level security;
alter table public.football_match_fan_votes enable row level security;
drop policy if exists "Polls are publicly readable" on public.football_match_polls;
create policy "Polls are publicly readable" on public.football_match_polls for select to anon, authenticated using (true);
drop policy if exists "Fans can read match poll results" on public.football_match_fan_votes;
create policy "Fans can read match poll results" on public.football_match_fan_votes for select to authenticated using (true);
drop policy if exists "Fans can submit one match vote" on public.football_match_fan_votes;
create policy "Fans can submit one match vote" on public.football_match_fan_votes for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.football_match_polls p where p.id = poll_id and now() between p.opens_at and p.closes_at));
drop policy if exists "Fans can update their match vote while poll is open" on public.football_match_fan_votes;
create policy "Fans can update their match vote while poll is open" on public.football_match_fan_votes for update to authenticated
  using (auth.uid() = user_id and exists (select 1 from public.football_match_polls p where p.id = poll_id and now() between p.opens_at and p.closes_at))
  with check (auth.uid() = user_id and exists (select 1 from public.football_match_polls p where p.id = poll_id and now() between p.opens_at and p.closes_at));
revoke all on table public.football_match_polls, public.football_match_fan_votes from public;
grant select on public.football_match_polls to anon, authenticated;
grant select, insert, update on public.football_match_fan_votes to authenticated;
grant all on public.football_match_polls, public.football_match_fan_votes to service_role;

create or replace function public.open_finished_football_match_poll()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'FT' and (tg_op = 'INSERT' or old.status is distinct from 'FT') then
    insert into public.football_match_polls(match_id, opens_at, closes_at)
    values (new.id, now(), now() + interval '24 hours')
    on conflict (match_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists football_match_finished_opens_poll on public.football_matches;
create trigger football_match_finished_opens_poll
after insert or update of status on public.football_matches
for each row execute function public.open_finished_football_match_poll();

-- A poll can be read after expiry for historical results; submissions are time-gated by RLS.

-- Backfill recently completed fixtures so polls are available immediately after rollout.
insert into public.football_match_polls(match_id, opens_at, closes_at)
select id, now(), now() + interval '24 hours'
from public.football_matches
where status = 'FT' and kickoff_at >= now() - interval '26 hours'
on conflict (match_id) do nothing;
