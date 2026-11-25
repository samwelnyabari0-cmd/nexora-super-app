-- Expose poll aggregates without exposing individual fan identities or tactical takes.
drop policy if exists "Fans can read match poll results" on public.football_match_fan_votes;
drop policy if exists "Fans can read their own match vote" on public.football_match_fan_votes;
create policy "Fans can read their own match vote"
  on public.football_match_fan_votes
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_football_match_poll_results(p_poll_ids uuid[])
returns table(poll_id uuid, vote_count bigint, average_rating numeric, top_player text, top_player_votes bigint)
language sql stable security definer set search_path = public
as $poll_results$
  with selected_votes as (
    select v.poll_id, v.player_name, v.rating
    from public.football_match_fan_votes v
    where v.poll_id = any(coalesce(p_poll_ids, array[]::uuid[]))
  ),
  totals as (
    select poll_id, count(*)::bigint as vote_count, round(avg(rating)::numeric, 1) as average_rating
    from selected_votes group by poll_id
  ),
  nominations as (
    select poll_id, player_name, count(*)::bigint as player_votes,
      row_number() over (partition by poll_id order by count(*) desc, player_name asc) as rank
    from selected_votes group by poll_id, player_name
  )
  select totals.poll_id, totals.vote_count, totals.average_rating, nominations.player_name, nominations.player_votes
  from totals left join nominations on nominations.poll_id = totals.poll_id and nominations.rank = 1;
$poll_results$;
revoke all on function public.get_football_match_poll_results(uuid[]) from public, anon;
grant execute on function public.get_football_match_poll_results(uuid[]) to authenticated;
