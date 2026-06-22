-- Add game_version column (semver encoded as major*10000 + minor*100 + patch).
-- e.g. v0.5.0 = 500, v0.6.0 = 600. NULL means the row predates versioning and
-- is excluded from the leaderboard by the gte filter in Leaderboard.tsx.

alter table public.games
  add column if not exists game_version integer;

-- Backfill: games created on or after 2026-06-21 UTC were running v0.5.0.
-- Games before that date remain NULL and are automatically excluded.
update public.games
  set game_version = 500
  where created_at >= '2026-06-21T00:00:00Z'
    and game_version is null;

-- Index for leaderboard queries that filter on game_version
create index if not exists games_game_version_idx
  on public.games (game_version, mode, game_type, final_score desc)
  where status in ('won', 'dead', 'bankrupt');
