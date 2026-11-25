-- =====================================================================
-- Migration 092 — player card leaderboard (opt-in).
--   * player_cards.on_board: the client chose to show their card.
--   * month_key / month_base: rating at the start of the month, for "Monthly movers".
--   * card_leaderboard(): stays closed until enough people opt in, and never
--     returns how many people are on it (so a small client base isn't visible).
-- =====================================================================
alter table public.player_cards add column if not exists on_board boolean not null default false;
alter table public.player_cards add column if not exists month_key text;
alter table public.player_cards add column if not exists month_base int;

-- Remember the rating at the start of each month
create or replace function private.card_month_base()
returns trigger
language plpgsql
set search_path = ''
as $$
declare m text := to_char(public.sydney_today(), 'YYYY-MM');
begin
  if new.month_key is distinct from m then
    new.month_base := case when tg_op = 'UPDATE' then coalesce(old.overall, new.overall) else new.overall end;
    new.month_key := m;
  elsif new.month_base is null then
    new.month_base := new.overall;
  end if;
  return new;
end $$;

do $$ begin execute 'drop trigger if exists player_cards_month_base on public.player_cards'; end $$;
create trigger player_cards_month_base
  before insert or update on public.player_cards
  for each row execute function private.card_month_base();

-- Opt in / out (the client's own card; creates the row if they haven't got one yet)
create or replace function public.set_card_on_board(p_on boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into player_cards (athlete_id, on_board) values (auth.uid(), p_on)
  on conflict (athlete_id) do update set on_board = excluded.on_board;
$$;
revoke execute on function public.set_card_on_board(boolean) from public, anon;
grant execute on function public.set_card_on_board(boolean) to authenticated;

-- The board. Opens once 8 people are on it. Returns names only for the top 10 of
-- each board, the caller's percentile in coarse steps, and never the head count.
create or replace function public.card_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with board as (
    select c.athlete_id, c.overall, c.tier, coalesce(c.overall - c.month_base, 0) as gain,
           coalesce(nullif(btrim(p.nickname), ''),
                    split_part(coalesce(p.full_name, 'Athlete'), ' ', 1)
                    || coalesce(' ' || left(nullif(split_part(p.full_name, ' ', 2), ''), 1) || '.', '')) as name,
           p.avatar_path
    from player_cards c
    join profiles p on p.id = c.athlete_id
    where c.on_board and c.overall is not null
      and p.role = 'athlete' and p.status = 'active' and not p.payment_hold
  ),
  ranked as (select *, rank() over (order by overall desc) r, rank() over (order by gain desc) g from board),
  stats as (select count(*) n from board),
  me as (
    select (select r from ranked where athlete_id = auth.uid()) my_rank,
           coalesce((select on_board from player_cards where athlete_id = auth.uid()), false) my_on
  )
  select case
    when auth.uid() is null or not (public.is_active_user() or public.is_coach()) then null
    when (select n from stats) < 8 then jsonb_build_object('open', false, 'me_on', (select my_on from me))
    else jsonb_build_object(
      'open', true,
      'me_on', (select my_on from me),
      -- coarse steps only, so a percentage can't give away how many people are on the board
      'my_top_pct', (
        select case when my_rank is null then null else
          (select min(b) from unnest(array[1, 5, 10, 25, 50, 75, 100]) b where b >= ceil(100.0 * my_rank / (select n from stats))) end
        from me),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('rank', r, 'name', name, 'avatar', avatar_path, 'overall', overall, 'tier', tier, 'me', athlete_id = auth.uid()) order by r, name)
        from ranked where r <= 10), '[]'::jsonb),
      'movers', coalesce((
        select jsonb_agg(jsonb_build_object('rank', g, 'name', name, 'avatar', avatar_path, 'gain', gain, 'overall', overall, 'tier', tier, 'me', athlete_id = auth.uid()) order by g, name)
        from ranked where gain > 0 and g <= 10), '[]'::jsonb)
    )
  end;
$$;
revoke execute on function public.card_leaderboard() from public, anon;
grant execute on function public.card_leaderboard() to authenticated;
