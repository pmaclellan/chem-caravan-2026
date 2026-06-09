-- Allow anyone (including unauthenticated visitors) to read finished games so
-- the leaderboard shows results from all players, not just the signed-in user.
--
-- PostgreSQL ORs multiple permissive SELECT policies, so this extends the
-- existing "users read own games" policy without replacing it.

create policy "leaderboard public reads"
  on public.games for select
  using (status in ('won', 'dead') and final_score is not null);
