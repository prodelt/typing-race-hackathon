-- Groups and leaderboards, built on the tables `races` created and never used.
--
-- 1. Test accounts. The e2e suite signs in with `is_test: true` in the user metadata; the sign-up
--    trigger copies it to `profiles.is_test`. A self-declared test flag is safe to trust, because
--    all it can do is take its owner off the boards. The accounts that smoke tests and earlier
--    e2e runs already created are marked here by their names.
-- 2. Groups: create, join by code, list members, remove (owner only), regenerate the code (owner
--    only), leave. Every write is a `security definer` RPC; the tables keep their select-only
--    policies, so there is no path to write them directly.
-- 3. Leaderboards: one read, `leaderboard(scope, language, group)`, computed from validated race
--    results at or above the 90% accuracy floor. One row per learner, their best result in scope,
--    ranked by the race's own score (speed weighted by accuracy squared). Real learners see only
--    real learners; test accounts see only test accounts, so a test run can prove its own board
--    without ever appearing on the one a jury looks at.
--
-- Nothing here exposes a profile beyond its display name.

-- ---------------------------------------------------------------------------------------------
-- 1. Test accounts
-- ---------------------------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  chosen text;
  testing boolean := coalesce(new.raw_user_meta_data ->> 'is_test', '') = 'true';
begin
  if wanted is null or char_length(wanted) < 2 then
    wanted := 'typist-' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  chosen := left(wanted, 32);

  -- Deterministic suffix from the user id, so a retried sign-up lands on the same name.
  if exists (select 1 from public.profiles p where lower(p.nickname) = lower(chosen)) then
    chosen := left(wanted, 27) || '-' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  insert into public.profiles (id, nickname, is_test) values (new.id, chosen, testing)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A learner may rename themself, but may not take themself off (or put someone on) the test list:
-- the flag is set once, at sign-up.
create function public.profiles_keep_test_flag() returns trigger
language plpgsql as $$
begin
  if new.is_test is distinct from old.is_test and current_user = 'authenticated' then
    new.is_test := old.is_test;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_test_flag
  before update on public.profiles
  for each row execute function public.profiles_keep_test_flag();

-- The junk already on the live project: manual probes, the smoke run and the race e2e's
-- "Host 12345" / "Guest 12345" pairs.
update public.profiles set is_test = true
where nickname ~* '^(probe|smoke)([ -]|$)'
   or nickname ~* '^(host|guest) [0-9]{3,6}(-[0-9a-f]{4})?$'
   or nickname ~* '^e2e[ -]';

-- The unused summary tables got a few of those rows before the flag existed.
delete from public.lb_global g using public.profiles p where p.id = g.user_id and p.is_test;
delete from public.lb_weekly w using public.profiles p where p.id = w.user_id and p.is_test;

-- ---------------------------------------------------------------------------------------------
-- 2. Groups
-- ---------------------------------------------------------------------------------------------

/** Six characters with no 0/O or 1/I, because a teacher reads it aloud to a room. */
create function public.fresh_group_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.join_code = code);
  end loop;
  return code;
end;
$$;

revoke execute on function public.fresh_group_code() from public, anon, authenticated;

create function public.is_group_owner(target uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.groups g where g.id = target and g.owner_id = auth.uid()
  );
$$;

create function public.create_group(p_name text)
returns table (group_id uuid, join_code text)
language plpgsql security definer set search_path = '' as $$
declare
  clean text := btrim(coalesce(p_name, ''));
  code text;
  created uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(clean) not between 2 and 64 then raise exception 'group name must be 2 to 64 characters'; end if;

  code := public.fresh_group_code();
  insert into public.groups (name, join_code, owner_id)
  values (clean, code, auth.uid())
  returning id into created;

  insert into public.group_members (group_id, user_id, role)
  values (created, auth.uid(), 'owner');

  return query select created, code;
end;
$$;

create function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select g.id into target from public.groups g where g.join_code = upper(btrim(p_code));
  if target is null then raise exception 'no group with that code'; end if;

  insert into public.group_members as m (group_id, user_id, role)
  values (target, auth.uid(), 'member')
  on conflict on constraint group_members_pkey do nothing;

  return target;
end;
$$;

/** The groups this learner belongs to, newest membership first. */
create function public.my_groups() returns jsonb
language sql security definer stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'role', m.role,
    'members', (select count(*) from public.group_members x where x.group_id = g.id)
  ) order by m.joined_at desc), '[]'::jsonb)
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.user_id = auth.uid();
$$;

/** One read for the group page: members only, display names only. */
create function public.group_snapshot(p_group uuid) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  grp public.groups%rowtype;
begin
  if not public.is_group_member(p_group) then raise exception 'not in this group'; end if;
  select * into grp from public.groups g where g.id = p_group;

  return jsonb_build_object(
    'id', grp.id,
    'name', grp.name,
    'joinCode', grp.join_code,
    'ownerId', grp.owner_id,
    'createdAt', grp.created_at,
    'me', auth.uid(),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'nickname', p.nickname, 'role', m.role, 'joinedAt', m.joined_at
      ) order by (m.role = 'owner') desc, m.joined_at)
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      where m.group_id = p_group
    ), '[]'::jsonb)
  );
end;
$$;

create function public.remove_group_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_owner(p_group) then raise exception 'only the owner can remove members'; end if;
  if p_user = auth.uid() then raise exception 'the owner leaves, not removes themself'; end if;
  delete from public.group_members m where m.group_id = p_group and m.user_id = p_user;
end;
$$;

create function public.regenerate_group_code(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if not public.is_group_owner(p_group) then raise exception 'only the owner can change the code'; end if;
  code := public.fresh_group_code();
  update public.groups g set join_code = code where g.id = p_group;
  return code;
end;
$$;

/**
 * Leaving. An owner leaving hands the group to whoever joined first after them; the last member
 * leaving deletes it, because a group nobody can see is only a row.
 */
create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  heir uuid;
begin
  if not public.is_group_member(p_group) then return; end if;

  delete from public.group_members m where m.group_id = p_group and m.user_id = auth.uid();

  if exists (select 1 from public.groups g where g.id = p_group and g.owner_id = auth.uid()) then
    select m.user_id into heir from public.group_members m
    where m.group_id = p_group order by m.joined_at limit 1;

    if heir is null then
      delete from public.groups g where g.id = p_group;
    else
      update public.groups g set owner_id = heir where g.id = p_group;
      update public.group_members m set role = 'owner'
      where m.group_id = p_group and m.user_id = heir;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Leaderboards
-- ---------------------------------------------------------------------------------------------

create index if not exists race_results_board_idx
  on public.race_results (finished_at)
  where validated;

/**
 * `p_scope`: 'all', 'week' (from Monday 00:00 Kyiv time) or 'group' (members of `p_group`, which
 * the caller must belong to). `p_language`: 'uk' (ЙЦУКЕН) or 'en' (QWERTY) — the room's language.
 * Readable without signing in for 'all' and 'week'; the caller's own row is marked when signed in.
 */
create function public.leaderboard(
  p_scope text,
  p_language text,
  p_group uuid default null,
  p_limit integer default 50
) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  viewer_test boolean := coalesce(
    (select p.is_test from public.profiles p where p.id = auth.uid()), false
  );
  week_start timestamptz := date_trunc('week', now() at time zone 'Europe/Kyiv')
    at time zone 'Europe/Kyiv';
  board jsonb;
begin
  if p_scope not in ('all', 'week', 'group') then raise exception 'unknown scope %', p_scope; end if;
  if p_language not in ('uk', 'en') then raise exception 'unknown language %', p_language; end if;
  if p_scope = 'group' and (p_group is null or not public.is_group_member(p_group)) then
    raise exception 'not in this group';
  end if;

  with eligible as (
    select
      x.user_id, x.spm, x.accuracy, x.score, x.finished_at,
      count(*) over (partition by x.user_id) as races,
      row_number() over (
        partition by x.user_id order by x.score desc, x.spm desc, x.finished_at
      ) as nth
    from public.race_results x
    join public.race_rooms r on r.id = x.room_id
    join public.profiles p on p.id = x.user_id
    where x.validated
      and x.accuracy >= 0.9
      and r.language = p_language
      and p.is_test = viewer_test
      and (p_scope <> 'week' or x.finished_at >= week_start)
      and (p_scope <> 'group' or exists (
        select 1 from public.group_members m where m.group_id = p_group and m.user_id = x.user_id
      ))
  ),
  ranked as (
    select e.*, row_number() over (order by e.score desc, e.spm desc, e.finished_at) as place
    from eligible e where e.nth = 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'place', k.place,
    'userId', k.user_id,
    'nickname', p.nickname,
    'spm', k.spm,
    'accuracy', k.accuracy,
    'score', k.score,
    'races', k.races,
    'finishedAt', k.finished_at
  ) order by k.place), '[]'::jsonb)
  into board
  from ranked k
  join public.profiles p on p.id = k.user_id
  where k.place <= greatest(1, least(p_limit, 200)) or k.user_id = auth.uid();

  return jsonb_build_object(
    'scope', p_scope,
    'language', p_language,
    'weekStart', week_start,
    'me', auth.uid(),
    'rows', board
  );
end;
$$;

grant execute on function public.leaderboard(text, text, uuid, integer) to anon, authenticated;
