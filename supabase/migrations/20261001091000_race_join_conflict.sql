-- Both join functions return a column named `room_id`, and PL/pgSQL resolves the bare `room_id`
-- in `on conflict (room_id, user_id)` against that output parameter, so every join failed with
-- "column reference is ambiguous". Naming the constraint removes the ambiguity.

create or replace function public.join_quick_match(p_language text, p_difficulty smallint)
returns table (room_id uuid, server_now timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  found_room uuid;
  chosen_text uuid;
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

  insert into public.race_participants as p (room_id, user_id, role)
  values (found_room, auth.uid(), 'racer')
  on conflict on constraint race_participants_pkey do nothing;

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
  insert into public.race_participants as p (room_id, user_id, role)
  values (
    found_room,
    auth.uid(),
    case when room_state = 'gathering' and seats < public.race_room_capacity()
      then 'racer' else 'spectator' end
  )
  on conflict on constraint race_participants_pkey do nothing;

  perform public.race_notify(found_room, 'roster');
  return query select found_room, now();
end;
$$;
