-- Cached competition standings from configured football data providers.
-- Public read-only; server-side sync writes rows.

create table if not exists public.football_standings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  competition_code text not null,
  competition_name text not null,
  season_id text not null,
  season_start date,
  season_end date,
  current_matchday integer,
  standing_type text not null default 'TOTAL',
  group_name text not null default '',
  position integer not null check (position > 0),
  team_provider_id text not null,
  team_name text not null,
  team_short_name text,
  team_crest_url text,
  played_games integer not null default 0 check (played_games >= 0),
  won integer not null default 0 check (won >= 0),
  drawn integer not null default 0 check (drawn >= 0),
  lost integer not null default 0 check (lost >= 0),
  points integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint football_standings_provider_competition_season_type_group_position_key
    unique (provider, competition_code, season_id, standing_type, group_name, position)
);

create index if not exists football_standings_competition_season_idx
  on public.football_standings (competition_code, season_id, standing_type, position);

create index if not exists football_standings_updated_at_idx
  on public.football_standings (updated_at desc);

alter table public.football_standings enable row level security;

drop policy if exists "Public can read football standings" on public.football_standings;
create policy "Public can read football standings"
  on public.football_standings
  for select
  to anon, authenticated
  using (true);

revoke all on table public.football_standings from public;
grant select on table public.football_standings to anon, authenticated;
grant all on table public.football_standings to service_role;

comment on table public.football_standings is
  'Cached competition standings from configured football data providers. Public read-only; server-side sync writes rows.';
