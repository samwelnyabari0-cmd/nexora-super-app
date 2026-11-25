-- Keep scorer sync metadata inaccessible to client roles while making the deny explicit to RLS lint.
drop policy if exists "Clients cannot read scorer sync metadata" on public.football_scorer_sync_runs;
create policy "Clients cannot read scorer sync metadata"
  on public.football_scorer_sync_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);
