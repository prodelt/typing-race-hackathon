-- Race Rating (CONTEXT.md, Game Layer): a learner's competitive standing, computed here, on the
-- server, from Validated Race Results only. The client reads it and never writes it.
--
-- The rule is multiplayer Elo, chosen because it is the one rating a player can check by hand:
--
--   * everyone starts at 1000;
--   * when a room finishes, every pair of racers on its start line is one game: the higher score
--     wins, equal scores draw;
--   * for each pair, expected = 1 / (1 + 10 ^ ((their rating - my rating) / 400));
--   * my change = round(32 * sum(actual - expected) / (racers - 1)), never below a floor of 100.
--
-- The start line is everyone who was in the room before the countdown began (plus anyone with a
-- result). "Score" is the room's own score (speed weighted by accuracy, `finish-race`). A result
-- the server did not validate, one below the 90% accuracy floor, and a race never finished (left,
-- or stepped back to watching) all count as 0: last place, so walking away from a race you are
-- losing cannot protect a rating. A start line of fewer than two (a lone quick match) changes
-- nothing. Test accounts are neither rated nor counted as opponents.
--
-- The same rule lives in TypeScript (`apps/web/src/features/race/rating.ts`) for its unit tests
-- and for the lobby's explanation; the two must stay equal.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.race_ratings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  rating integer not null default 1000 check (rating >= 100),
  -- Rated races only: a lone quick match is not one.
  races integer not null default 0,
  last_room uuid references public.race_rooms (id) on delete set null,
  last_delta integer not null default 0,
  updated_at timestamptz not null default now()
);

/**
 * One row per rated racer per room: the audit trail of every change, and the guard that rates a
 * room exactly once.
 */
create table public.race_rating_changes (
  room_id uuid not null references public.race_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating_before integer not null,
  rating_after integer not null,
  opponents integer not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index race_rating_changes_user_idx on public.race_rating_changes (user_id, created_at);

alter table public.race_ratings enable row level security;
alter table public.race_rating_changes enable row level security;

-- A learner reads their own standing; nobody but `rate_race` writes either table.
create policy race_ratings_select_own on public.race_ratings
  for select to authenticated using ((select auth.uid()) = user_id);

create policy race_rating_changes_select_own on public.race_rating_changes
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.race_ratings from anon;
revoke all on public.race_rating_changes from anon;
revoke insert, update, delete, truncate on public.race_ratings from authenticated;
revoke insert, update, delete, truncate on public.race_rating_changes from authenticated;

-- ---------------------------------------------------------------------------------------------
-- The rule
-- ---------------------------------------------------------------------------------------------

create function public.race_rating_start() returns integer
language sql immutable set search_path = '' as $$ select 1000 $$;

create function public.race_rating_k() returns integer
language sql immutable set search_path = '' as $$ select 32 $$;

create function public.race_rating_floor() returns integer
language sql immutable set search_path = '' as $$ select 100 $$;

/**
 * A room's start line with the score each racer counts as: everyone who joined before the start,
 * plus anyone with a result; test accounts out. Unvalidated, below 90% or unfinished scores 0.
 */
create function public.race_rating_field(p_room uuid)
returns table (user_id uuid, score numeric)
language sql stable security definer set search_path = '' as $$
  select
    p.user_id,
    coalesce(case when x.validated and x.accuracy >= 0.9 then x.score end, 0)::numeric
  from public.race_participants p
  join public.race_rooms r on r.id = p.room_id
  join public.profiles pr on pr.id = p.user_id
  left join public.race_results x on x.room_id = p.room_id and x.user_id = p.user_id
  where p.room_id = p_room
    and not pr.is_test
    and (x.user_id is not null or (r.starts_at is not null and p.joined_at <= r.starts_at));
$$;

/**
 * Rates one finished room, once. Called by the trigger below when the room's state becomes
 * `finished`; a second call for the same room does nothing.
 */
create function public.rate_race(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.race_rating_changes c where c.room_id = p_room) then return; end if;
  if (select count(*) from public.race_rating_field(p_room)) < 2 then return; end if;

  -- Everyone on the start line gets a row at the starting rating, then the rows are locked in a
  -- fixed order so two rooms finishing at once cannot deadlock on a shared racer.
  insert into public.race_ratings (user_id, rating)
  select f.user_id, public.race_rating_start() from public.race_rating_field(p_room) f
  on conflict (user_id) do nothing;

  perform 1
  from public.race_ratings r
  where r.user_id in (select f.user_id from public.race_rating_field(p_room) f)
  order by r.user_id
  for update;

  with field as (
    select f.user_id, f.score, r.rating
    from public.race_rating_field(p_room) f
    join public.race_ratings r on r.user_id = f.user_id
  ),
  games as (
    select
      a.user_id,
      a.rating,
      count(*) as opponents,
      sum(
        (case when a.score > b.score then 1.0 when a.score = b.score then 0.5 else 0.0 end)::float8
        - 1.0::float8 / (1.0::float8 + power(10.0::float8, (b.rating - a.rating)::float8 / 400.0::float8))
      ) as surplus
    from field a
    join field b on b.user_id <> a.user_id
    group by a.user_id, a.rating
  )
  insert into public.race_rating_changes (room_id, user_id, rating_before, rating_after, opponents)
  select
    p_room,
    g.user_id,
    g.rating,
    -- `round(numeric)` rounds half away from zero; the TypeScript mirror does the same.
    greatest(
      public.race_rating_floor(),
      g.rating + round((public.race_rating_k() * g.surplus / g.opponents)::numeric)::integer
    ),
    g.opponents
  from games g;

  update public.race_ratings r set
    rating = c.rating_after,
    races = r.races + 1,
    last_room = p_room,
    last_delta = c.rating_after - c.rating_before,
    updated_at = now()
  from public.race_rating_changes c
  where c.room_id = p_room and c.user_id = r.user_id;
end;
$$;

create function public.race_room_rated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.rate_race(new.id);
  return new;
end;
$$;

create trigger race_room_rating
  after update of state on public.race_rooms
  for each row
  when (new.state = 'finished' and old.state is distinct from 'finished')
  execute function public.race_room_rated();

-- Internal only: the trigger runs them as their owner. New functions are already private by the
-- default privileges of `server_hardening`; this says so explicitly for the reader.
revoke execute on function public.race_rating_start() from public, anon, authenticated;
revoke execute on function public.race_rating_k() from public, anon, authenticated;
revoke execute on function public.race_rating_floor() from public, anon, authenticated;
revoke execute on function public.race_rating_field(uuid) from public, anon, authenticated;
revoke execute on function public.rate_race(uuid) from public, anon, authenticated;
revoke execute on function public.race_room_rated() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Backfill: the rooms that finished before this migration, in the order they finished
-- ---------------------------------------------------------------------------------------------

do $$
declare
  room uuid;
begin
  for room in
    select r.id from public.race_rooms r
    where r.state = 'finished'
    order by r.finished_at nulls first, r.created_at
  loop
    perform public.rate_race(room);
  end loop;
end;
$$;
