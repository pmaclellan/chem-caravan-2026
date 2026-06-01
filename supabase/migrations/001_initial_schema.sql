create table public.games (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references auth.users not null,
  character_name   text        not null check (char_length(character_name) between 1 and 30),
  state            jsonb       not null,
  status           text        not null default 'active'
                               check (status in ('active', 'won', 'dead', 'bankrupt')),
  final_score      integer,
  -- Extracted from JSONB for efficient querying (multiplayer-ready)
  current_location text,
  is_traveling     boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index games_score_idx    on public.games (final_score desc) where status != 'active';
create index games_user_idx     on public.games (user_id);
create index games_location_idx on public.games (current_location) where status = 'active';

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_set_updated_at
  before update on public.games
  for each row execute procedure public.set_updated_at();
