-- What the race flow needs on top of `races`: the pieces the first migration named but did not
-- build, found by walking one race end to end against the live project.
--
-- 1. Anonymous identities with a chosen display name. Two people both called "Оля" must both get
--    in, so a taken nickname gets a short suffix instead of failing the sign-up.
-- 2. Private rooms: created with a join code, started by their host.
-- 3. The start rule lives in the database: a quick match gathers for three seconds once a second
--    racer is in (or lets a lone racer go after twenty), and every client asks the same function,
--    which starts the countdown once and returns the same `starts_at` to everyone after.
-- 4. One read for everything a room screen shows (`room_snapshot`), because the roster needs
--    other racers' nicknames and `profiles` is readable only by its owner.
-- 5. Realtime authorisation for the private `race:<room>` channel: participants only.
-- 6. Settling: a room is finished when every racer has a result or has become a spectator, or
--    when its three-minute deadline passes.
-- 7. The race texts themselves, which nothing had seeded.

-- ---------------------------------------------------------------------------------------------
-- 1. Display names
-- ---------------------------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  chosen text;
begin
  if wanted is null or char_length(wanted) < 2 then
    wanted := 'typist-' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  chosen := left(wanted, 32);

  -- Deterministic suffix from the user id, so a retried sign-up lands on the same name.
  if exists (select 1 from public.profiles p where lower(p.nickname) = lower(chosen)) then
    chosen := left(wanted, 27) || '-' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  insert into public.profiles (id, nickname) values (new.id, chosen)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Rooms: a host, a deadline
-- ---------------------------------------------------------------------------------------------

alter table public.race_rooms
  add column host_id uuid references public.profiles (id) on delete set null;

/** How long a race may run before it is settled without the stragglers. */
create function public.race_time_limit() returns interval
language sql immutable as $$ select interval '3 minutes' $$;

create function public.race_text_for(p_language text, p_difficulty smallint) returns uuid
language sql volatile security definer set search_path = '' as $$
  select t.id from public.race_texts t
  where t.language = p_language and t.difficulty = p_difficulty
  order by random() limit 1;
$$;

create function public.create_private_room(p_language text)
returns table (room_id uuid, join_code text, server_now timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  chosen_text uuid;
  code text;
  created uuid;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_language not in ('uk', 'en') then raise exception 'unknown language %', p_language; end if;

  chosen_text := public.race_text_for(p_language, 2::smallint);
  if chosen_text is null then raise exception 'no race text for %', p_language; end if;

  -- No 0/O or 1/I: the code is read aloud and typed by someone across the room.
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.race_rooms r where r.join_code = code);
  end loop;

  insert into public.race_rooms (visibility, join_code, language, difficulty, text_id, host_id)
  values ('private', code, p_language, 2, chosen_text, auth.uid())
  returning id into created;

  insert into public.race_participants (room_id, user_id, role)
  values (created, auth.uid(), 'racer');

  return query select created, code, now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Realtime helper: tell everyone in the room to re-read it
-- ---------------------------------------------------------------------------------------------

create function public.race_notify(p_room uuid, p_event text, p_payload jsonb default '{}')
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, 'race:' || p_room::text, true);
end;
$$;

revoke execute on function public.race_notify(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Joining, again: the same rules as before, plus a roster ping
-- ---------------------------------------------------------------------------------------------

create or replace function public.join_quick_match(p_language text, p_difficulty smallint)
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
    and (select count(*) from public.race_participants p
         where p.room_id = r.id and p.role = 'racer') < public.race_room_capacity()
  order by r.created_at
  for update skip locked
  limit 1;

  if found_room is null then
    chosen_text := public.race_text_for(p_language, p_difficulty);
    if chosen_text is null then raise exception 'no race text for % at difficulty %',
      p_language, p_difficulty; end if;

    insert into public.race_rooms (language, difficulty, text_id)
    values (p_language, p_difficulty, chosen_text)
    returning id into found_room;
  end if;

  insert into public.race_participants (room_id, user_id, role)
  values (found_room, auth.uid(), 'racer')
  on conflict (room_id, user_id) do nothing;

  perform public.race_notify(found_room, 'roster');
  return query select found_room, now();
end;
$$;

create or replace function public.join_by_code(p_code text)
returns table (room_id uuid, server_now timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  found_room uuid;
  room_state text;
  seats integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select r.id, r.state into found_room, room_state
  from public.race_rooms r where r.join_code = upper(btrim(p_code))
  for update;

  if found_room is null then raise exception 'no room with that code'; end if;

  select count(*) into seats
  from public.race_participants p
  where p.room_id = found_room and p.role = 'racer';

  -- A latecomer, or anyone arriving at a full room, watches rather than being turned away.
  insert into public.race_participants (room_id, user_id, role)
  values (
    found_room,
    auth.uid(),
    case when room_state = 'gathering' and seats < public.race_room_capacity()
      then 'racer' else 'spectator' end
  )
  on conflict (room_id, user_id) do nothing;

  perform public.race_notify(found_room, 'roster');
  return query select found_room, now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Starting
-- ---------------------------------------------------------------------------------------------

/**
 * Asked by every client in the room; answers with `starts_at` once the race has a start, and null
 * while it is still gathering. Idempotent, so a retry or a second racer asking in the same instant
 * gets the same start rather than an error.
 *
 * Quick match: three seconds after the second racer arrived, or twenty seconds after the room was
 * opened if nobody came. Private room: when its host says so.
 */
create or replace function public.start_race(p_room uuid)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  room public.race_rooms%rowtype;
  racers integer;
  second_arrival timestamptz;
  begins timestamptz;
begin
  if not public.is_race_participant(p_room) then raise exception 'not in this room'; end if;

  select * into room from public.race_rooms r where r.id = p_room for update;
  if room.state <> 'gathering' then return room.starts_at; end if;

  select count(*) into racers
  from public.race_participants p where p.room_id = p_room and p.role = 'racer';

  if room.visibility = 'private' then
    if room.host_id is distinct from auth.uid() then return null; end if;
  else
    select p.joined_at into second_arrival
    from public.race_participants p
    where p.room_id = p_room and p.role = 'racer'
    order by p.joined_at offset 1 limit 1;

    if not (
      (racers >= 2 and now() >= second_arrival + interval '3 seconds')
      or now() >= room.created_at + interval '20 seconds'
    ) then
      return null;
    end if;
  end if;

  -- Three seconds of 3-2-1: long enough for the slowest client to hear about it.
  begins := now() + interval '3 seconds';

  update public.race_rooms set state = 'countdown', starts_at = begins where id = p_room;

  perform public.race_notify(
    p_room, 'state', jsonb_build_object('state', 'countdown', 'startsAt', begins)
  );
  return begins;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Settling
-- ---------------------------------------------------------------------------------------------

/**
 * Finishes the room once nobody is still racing: every racer has a result or has stepped back to
 * watching, or the time limit has passed. Called by `finish-race` after each result, by
 * `become_spectator`, and lazily by `room_snapshot`.
 */
create function public.settle_race(p_room uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  room public.race_rooms%rowtype;
  outstanding integer;
begin
  select * into room from public.race_rooms r where r.id = p_room;
  if room.id is null or room.starts_at is null then return false; end if;
  if room.state = 'finished' then return true; end if;

  select count(*) into outstanding
  from public.race_participants p
  where p.room_id = p_room and p.role = 'racer'
    and not exists (
      select 1 from public.race_results x where x.room_id = p_room and x.user_id = p.user_id
    );

  if outstanding > 0 and now() < room.starts_at + public.race_time_limit() then
    update public.race_rooms set state = 'running'
    where id = p_room and state = 'countdown' and now() >= room.starts_at;
    return false;
  end if;

  update public.race_rooms set state = 'finished', finished_at = now()
  where id = p_room and state <> 'finished';
  perform public.race_notify(p_room, 'state', jsonb_build_object('state', 'finished'));
  return true;
end;
$$;

revoke execute on function public.settle_race(uuid) from public, anon, authenticated;

/** An idle racer steps back to watching, so the room does not wait for them. */
create function public.become_spectator(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.race_participants p set role = 'spectator'
  where p.room_id = p_room and p.user_id = auth.uid() and p.role = 'racer'
    and not exists (
      select 1 from public.race_results x where x.room_id = p_room and x.user_id = auth.uid()
    );
  if found then
    perform public.race_notify(p_room, 'roster');
    perform public.settle_race(p_room);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The one read a room screen needs
-- ---------------------------------------------------------------------------------------------

/**
 * The room, its roster with nicknames, and its results, for participants only. The text is
 * withheld until the countdown starts, so nobody can read ahead while the room gathers.
 */
create function public.room_snapshot(p_room uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  room public.race_rooms%rowtype;
  body text;
begin
  if not public.is_race_participant(p_room) then raise exception 'not in this room'; end if;

  perform public.settle_race(p_room);
  select * into room from public.race_rooms r where r.id = p_room;

  if room.starts_at is not null then
    select t.body into body from public.race_texts t where t.id = room.text_id;
  end if;

  return jsonb_build_object(
    'id', room.id,
    'state', room.state,
    'visibility', room.visibility,
    'joinCode', room.join_code,
    'language', room.language,
    'hostId', room.host_id,
    'createdAt', room.created_at,
    'startsAt', room.starts_at,
    'deadline', room.starts_at + public.race_time_limit(),
    'serverNow', now(),
    'text', body,
    'me', auth.uid(),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', p.user_id, 'nickname', pr.nickname, 'role', p.role, 'joinedAt', p.joined_at
      ) order by p.joined_at)
      from public.race_participants p
      join public.profiles pr on pr.id = p.user_id
      where p.room_id = p_room
    ), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', x.user_id, 'nickname', pr.nickname, 'spm', x.spm, 'accuracy', x.accuracy,
        'score', x.score, 'validated', x.validated, 'reason', x.rejection_reason,
        'finishedAt', x.finished_at
      ) order by x.validated desc, x.score desc, x.spm desc, x.finished_at)
      from public.race_results x
      join public.profiles pr on pr.id = x.user_id
      where x.room_id = p_room
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Realtime: the private `race:<room>` channel, participants only
-- ---------------------------------------------------------------------------------------------

create function public.race_topic_allowed(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  room uuid;
begin
  if p_topic is null or p_topic !~ '^race:[0-9a-f-]{36}$' then return false; end if;
  room := substr(p_topic, 6)::uuid;
  return public.is_race_participant(room);
end;
$$;

create policy race_channel_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.race_topic_allowed((select realtime.topic()))
  );

create policy race_channel_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.race_topic_allowed((select realtime.topic()))
  );

-- ---------------------------------------------------------------------------------------------
-- 7. Race texts — authored by the project, typeable on both layouts as shipped (no apostrophe,
--    question or exclamation mark on the Ukrainian side, which the ЙЦУКЕН map does not carry).
-- ---------------------------------------------------------------------------------------------

insert into public.race_texts (language, difficulty, body, content_hash)
select language, 2, body, md5(body)
from (values
  ('uk', 'Ранок у горах починається тихо. Спершу світлішає небо над хребтом, потім на траві спалахують краплі роси, і долина поволі наповнюється голосами птахів. Пастух виводить отару на схил, а внизу над річкою ще довго тримається білий туман, схожий на пухку вовну.'),
  ('uk', 'Добрий майстер ніколи не поспішає. Він спершу уважно роздивляється дерево, шукає напрям волокон і тільки тоді береться до різця. Так само і з набором тексту: точність народжується з уваги, а швидкість приходить згодом, коли пальці вже знають дорогу самі.'),
  ('uk', 'Київ стоїть на пагорбах над широким Дніпром. Навесні його вулиці тонуть у цвіті каштанів, а вечорами на набережній збираються музиканти й художники. Мости світяться вогнями, по воді повільно пливуть човни, і місто здається спокійним, хоча ніколи не спить.'),
  ('uk', 'Бібліотека пахла старим папером і деревом. Між високими полицями панувала тиша, яку порушував лише шелест сторінок. Дівчина знайшла на нижній полиці потерту книжку про далекі острови, сіла біля вікна і читала аж до вечора, забувши про час.'),
  ('en', 'The river bends twice before it reaches the old mill. In spring the water runs fast and cold, carrying branches down from the hills, but by late summer it slows to a quiet stream where children wade and herons stand still for hours, waiting for a fish.'),
  ('en', 'Good typing starts with calm hands. Rest your fingers on the home row, keep your wrists loose and look at the screen, not the keys. Speed will come later, almost by itself, once every finger knows its own small territory on the keyboard.'),
  ('en', 'The night train left the station at ten. Most passengers were already asleep, but a woman by the window kept writing in a small notebook, stopping only when the lights of a town flashed past. By morning she had filled every page with notes about the journey.'),
  ('en', 'A lighthouse keeper once said that the sea is never the same twice. Some days it is flat and silver, other days it throws grey walls of water against the rocks. He kept a log of the weather for forty years, and every entry began with the same line: the lamp is lit.')
) as seed (language, body);
