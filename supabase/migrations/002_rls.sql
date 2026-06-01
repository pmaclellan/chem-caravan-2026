alter table public.games enable row level security;

create policy "users read own games"
  on public.games for select
  using (auth.uid() = user_id);

create policy "users insert own games"
  on public.games for insert
  with check (auth.uid() = user_id);

create policy "users update own games"
  on public.games for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public leaderboard via security-definer function (bypasses RLS safely for anonymous reads)
create or replace function public.get_leaderboard()
returns table (
  character_name text,
  final_score    integer,
  status         text,
  created_at     timestamptz,
  rank           bigint
)
language sql security definer as $$
  select
    character_name,
    final_score,
    status,
    created_at,
    rank() over (order by final_score desc)
  from public.games
  where status != 'active'
    and final_score is not null
  order by final_score desc
  limit 100;
$$;
