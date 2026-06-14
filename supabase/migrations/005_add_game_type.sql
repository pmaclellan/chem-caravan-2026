-- Add game_type column to distinguish standard vs free play runs.
-- Defaults to 'standard' so all existing rows remain valid without backfill.

alter table public.games
  add column if not exists game_type text not null default 'standard';

-- Index for efficient free-play leaderboard queries
create index if not exists games_game_type_idx
  on public.games (game_type, mode, final_score desc)
  where status in ('won', 'dead');
