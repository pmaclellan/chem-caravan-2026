-- Add mode and turns_reached columns to games table for v2.0 multi-region support.
-- mode is nullable so old rows (pre-v2.0) remain valid.

alter table public.games
  add column if not exists mode          text,
  add column if not exists turns_reached integer;

-- Index for efficient per-mode active-game lookups (one active slot per user per mode)
create index if not exists games_user_mode_idx
  on public.games (user_id, mode)
  where status = 'active';

-- Backfill mode from JSONB state blob for any existing active rows
update public.games
  set mode = state->>'mode'
  where mode is null and state is not null and state->>'mode' is not null;
