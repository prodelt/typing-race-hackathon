-- F5: groups, race rooms and leaderboards. Ticket 14 for the rules, ticket 21 for the shapes.
--
-- The one idea the whole file is arranged around: **the database is the authority on time and on
-- results, and Broadcast is only a picture of them** (ADR-0006).
--
-- A race has two channels of truth running at once. Progress messages fly twice a second so the
-- lanes move smoothly; they are display only, and nothing is ever decided from them. The start is
-- anchored to a server timestamp sent by the database itself through `realtime.send()` inside
-- `start_race`, so a client cannot forge an early start. And a finish is not a result until the
-- `finish-race` Edge Function has replayed the keystroke log against the race text.
--
-- Ticket 05 measured the binding limit: Realtime throughput, roughly 100 messages a second, not
-- connections. Five racers at two messages a second is ten, so ten to twenty concurrent races is
-- the ceiling the free tier gives us. Room size is capped at five for that reason, not an
-- arbitrary one.

-- ---------------------------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 64),
  -- Short, human-sayable, and unique: a teacher reads it out to a room.
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'teacher', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Membership is the visibility rule everywhere in this file. A learner sees a group because they
-- are in it, never because they guessed its id.
create function public.is_group_member(target uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = target and m.user_id = auth.uid()
  );
$$;

create policy groups_select_member on public.groups
  for select using (public.is_group_member(id));

create policy group_members_select_member on public.group_members
  for select using (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------------------------
-- Race texts
-- ---------------------------------------------------------------------------------------------

-- Public read, seeded at deploy from our own corpora. `content_hash` is what a replay checks the
-- attempt against, so a text edited after a race cannot retroactively invalidate its results.
create table public.race_texts (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('uk', 'en')),
  difficulty smallint not null check (difficulty between 1 and 5),
  body text not null check (char_length(body) between 200 and 400),
  content_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.race_texts enable row level security;

create policy race_texts_select_all on public.race_texts
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------------------------
-- Race rooms
-- ---------------------------------------------------------------------------------------------

create table public.race_rooms (
  id uuid primary key default gen_random_uuid(),
  -- `gathering → countdown → running → finished`, advanced only by the RPCs below.
  state text not null default 'gathering'
    check (state in ('gathering', 'countdown', 'running', 'finished')),
  visibility text not null default 'quick' check (visibility in ('quick', 'private')),
  join_code text unique check (join_code is null or join_code ~ '^[A-Z0-9]{6}$'),
  language text not null check (language in ('uk', 'en')),
  difficulty smallint not null check (difficulty between 1 and 5),
  text_id uuid not null references public.race_texts (id),
  -- Server time, set by `start_race`. The only start anyone is allowed to believe.
  starts_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index race_rooms_matchable_idx
  on public.race_rooms (language, difficulty, created_at)
  where state = 'gathering' and visibility = 'quick';

create table public.race_participants (
  room_id uuid not null references public.race_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Ticket 14: a latecomer or an idler becomes a spectator rather than being turned away. They
  -- see the race; they simply do not score.
  role text not null default 'racer' check (role in ('racer', 'spectator')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

/** Five racers at two Broadcast messages a second is ten a second — see the header. */
create function public.race_room_capacity() returns integer
language sql immutable as $$ select 5 $$;

alter table public.race_rooms enable row level security;
alter table public.race_participants enable row level security;

create function public.is_race_participant(target uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.race_participants p
    where p.room_id = target and p.user_id = auth.uid()
  );
$$;

create policy race_rooms_select_participant on public.race_rooms
  for select using (public.is_race_participant(id));

create policy race_participants_select_participant on public.race_participants
  for select using (public.is_race_participant(room_id));

-- ---------------------------------------------------------------------------------------------
-- Race results
-- ---------------------------------------------------------------------------------------------

create table public.race_results (
  room_id uuid not null references public.race_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete set null,
  spm numeric(7, 2) not null,
  accuracy numeric(5, 4) not null check (accuracy between 0 and 1),
  -- Ticket 14: the winner is decided on speed weighted by accuracy, with a 90% floor. Racing
  -- rewards fast *and* clean, or it teaches the opposite of the curriculum.
  score numeric(9, 2) not null,
  -- **False until `finish-race` has replayed the log against the race text.** Every leaderboard
  -- reads only validated rows; an unvalidated finish is a claim.
  validated boolean not null default false,
  rejection_reason text,
  finished_at timestamptz not null default now(),

  primary key (room_id, user_id)
);

alter table public.race_results enable row level security;

create policy race_results_select_participant on public.race_results
  for select using (public.is_race_participant(room_id));

-- ---------------------------------------------------------------------------------------------
-- Room operations — `security definer` RPCs, because a client may not write these tables
-- ---------------------------------------------------------------------------------------------

/**
 * Quick match. The row lock is the point: two people pressing the button in the same instant must
 * not each create a room and then sit alone in it, which is the classic matchmaking bug.
 */
create function public.join_quick_match(p_language text, p_difficulty smallint)
returns table (room_id uuid, server_now timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  found_room uuid;
  chosen_text uuid;
  seats integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select r.id into found_room
  from public.race_rooms r
  where r.state = 'gathering' and r.visibility = 'quick'
    and r.language = p_language and r.difficulty = p_difficulty
  order by r.created_at
  for update skip locked
  limit 1;

  if found_room is not null then
    select count(*) into seats
    from public.race_participants p
    where p.room_id = found_room and p.role = 'racer';
    if seats >= public.race_room_capacity() then found_room := null; end if;
  end if;

  if found_room is null then
    select t.id into chosen_text
    from public.race_texts t
    where t.language = p_language and t.difficulty = p_difficulty
    order by random()
    limit 1;

    if chosen_text is null then raise exception 'no race text for % at difficulty %',
      p_language, p_difficulty; end if;

    insert into public.race_rooms (language, difficulty, text_id)
    values (p_language, p_difficulty, chosen_text)
    returning id into found_room;
  end if;

  insert into public.race_participants (room_id, user_id, role)
  values (found_room, auth.uid(), 'racer')
  on conflict (room_id, user_id) do nothing;

  -- The server clock, returned so the client can compute its offset once and then trust its own
  -- clock for the countdown. Without it every lane would drift by the round trip.
  return query select found_room, now();
end;
$$;

create function public.join_by_code(p_code text)
returns table (room_id uuid, server_now timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  found_room uuid;
  room_state text;
  seats integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select r.id, r.state into found_room, room_state
  from public.race_rooms r where r.join_code = upper(p_code)
  for update;

  if found_room is null then raise exception 'no room with that code'; end if;

  select count(*) into seats
  from public.race_participants p
  where p.room_id = found_room and p.role = 'racer';

  -- A latecomer watches rather than being refused (ticket 14). So does anyone arriving at a full
  -- room. Being told "no" is a worse answer than being let in to watch.
  insert into public.race_participants (room_id, user_id, role)
  values (
    found_room,
    auth.uid(),
    case when room_state = 'gathering' and seats < public.race_room_capacity()
      then 'racer' else 'spectator' end
  )
  on conflict (room_id, user_id) do nothing;

  return query select found_room, now();
end;
$$;

/**
 * Starts the countdown and **broadcasts the start itself from inside the database**. A client
 * that announced its own start could announce it early; this one cannot be forged, and every lane
 * anchors to the same `starts_at` (ADR-0006).
 */
create function public.start_race(p_room uuid)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  begins timestamptz;
begin
  if not public.is_race_participant(p_room) then raise exception 'not in this room'; end if;

  -- Three seconds: long enough for the slowest client to receive the message and render a
  -- countdown, short enough that nobody wanders off.
  begins := now() + interval '3 seconds';

  update public.race_rooms
  set state = 'countdown', starts_at = begins
  where id = p_room and state = 'gathering';

  if not found then raise exception 'race already started'; end if;

  perform realtime.send(
    jsonb_build_object('state', 'countdown', 'startsAt', begins),
    'state',
    'race:' || p_room::text,
    true
  );

  return begins;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Leaderboards — summary tables, maintained from validated results only
-- ---------------------------------------------------------------------------------------------

create table public.lb_global (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  races integer not null default 0,
  best_score numeric(9, 2) not null default 0,
  total_score numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.lb_weekly (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The Monday of the week in Kyiv time; `pg_cron` rolls it over.
  week_start date not null,
  races integer not null default 0,
  best_score numeric(9, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table public.group_practice (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The teacher's columns. Ticket 14 is explicit that these are **shown, not scored** — a group
  -- board that ranked on minutes practised would reward sitting at the keyboard.
  minutes_practised integer not null default 0,
  attempts integer not null default 0,
  unlocked_keys integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.lb_global enable row level security;
alter table public.lb_weekly enable row level security;
alter table public.group_practice enable row level security;

-- Leaderboards are public to signed-in learners: that is what a leaderboard is. Test accounts are
-- filtered by the views below rather than by policy, so the rows still exist for debugging.
create policy lb_global_select on public.lb_global for select to authenticated using (true);
create policy lb_weekly_select on public.lb_weekly for select to authenticated using (true);
create policy group_practice_select_member on public.group_practice
  for select using (public.is_group_member(group_id));

create function public.apply_race_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_test_account boolean;
  monday date;
begin
  if not new.validated then return new; end if;
  if tg_op = 'UPDATE' and old.validated then return new; end if;

  select p.is_test into is_test_account from public.profiles p where p.id = new.user_id;
  -- A preview smoke test races like anyone else and scores like nobody (ticket 15).
  if is_test_account then return new; end if;

  insert into public.lb_global (user_id, races, best_score, total_score)
  values (new.user_id, 1, new.score, new.score)
  on conflict (user_id) do update set
    races = public.lb_global.races + 1,
    best_score = greatest(public.lb_global.best_score, excluded.best_score),
    total_score = public.lb_global.total_score + excluded.total_score,
    updated_at = now();

  monday := date_trunc('week', (now() at time zone 'Europe/Kyiv'))::date;

  insert into public.lb_weekly (user_id, week_start, races, best_score)
  values (new.user_id, monday, 1, new.score)
  on conflict (user_id, week_start) do update set
    races = public.lb_weekly.races + 1,
    best_score = greatest(public.lb_weekly.best_score, excluded.best_score),
    updated_at = now();

  return new;
end;
$$;

/**
 * Only validated results reach a board, and only once: the guard on `old.validated` means the
 * `finish-race` function can set the flag without risking a double count if it is ever retried.
 */
create trigger race_result_scored
  after insert or update of validated on public.race_results
  for each row execute function public.apply_race_result();
