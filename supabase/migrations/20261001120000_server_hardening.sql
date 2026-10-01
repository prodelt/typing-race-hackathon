-- Server hardening: tighter RLS, least-privilege RPC grants, a per-user request window for the
-- write functions, generated guest nicks, account deletion support and a purge of abandoned
-- anonymous users.
--
-- Anonymous users sign in with the `authenticated` role too, so every `to authenticated` below
-- keeps guests working exactly as before; only the unauthenticated `anon` key loses access.

-- ---------------------------------------------------------------------------------------------
-- 1. Owner policies: `(select auth.uid())` runs once per statement instead of once per row, and
--    naming the role keeps `anon` requests from evaluating the policy at all.
-- ---------------------------------------------------------------------------------------------

drop policy profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy attempts_select_own on public.attempts;
create policy attempts_select_own on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy keystroke_logs_select_own on public.keystroke_logs;
create policy keystroke_logs_select_own on public.keystroke_logs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy progress_select_own on public.progress;
create policy progress_select_own on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);

-- Membership policies call a helper per row by design (the helper itself caches nothing worth
-- hoisting); they only need the role narrowed.
alter policy groups_select_member on public.groups to authenticated;
alter policy group_members_select_member on public.group_members to authenticated;
alter policy group_practice_select_member on public.group_practice to authenticated;
alter policy race_rooms_select_participant on public.race_rooms to authenticated;
alter policy race_participants_select_participant on public.race_participants to authenticated;
alter policy race_results_select_participant on public.race_results to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. RPC grants. Supabase grants EXECUTE on every new public function to `anon` and
--    `authenticated`; take that back and hand out only what the app calls.
-- ---------------------------------------------------------------------------------------------

alter function public.race_room_capacity() set search_path = '';
alter function public.race_time_limit() set search_path = '';
alter function public.profiles_keep_test_flag() set search_path = '';

-- Internal: triggers, helpers called only from other `security definer` functions (which run as
-- their owner), and maintenance jobs.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.apply_race_result() from public, anon, authenticated;
revoke execute on function public.profiles_keep_test_flag() from public, anon, authenticated;
revoke execute on function public.prune_keystroke_logs(integer) from public, anon, authenticated;
revoke execute on function public.race_text_for(text, smallint) from public, anon, authenticated;
revoke execute on function public.is_group_owner(uuid) from public, anon, authenticated;
revoke execute on function public.race_room_capacity() from public, anon, authenticated;
revoke execute on function public.race_time_limit() from public, anon, authenticated;
grant execute on function public.prune_keystroke_logs(integer) to service_role;

-- Signed-in learners (guests included). The three `is_*`/`*_allowed` helpers stay callable
-- because RLS and Realtime policies evaluate them as the caller.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.become_spectator(uuid)',
    'public.create_group(text)',
    'public.create_private_room(text)',
    'public.group_snapshot(uuid)',
    'public.join_by_code(text)',
    'public.join_group(text)',
    'public.join_quick_match(text, smallint)',
    'public.leave_group(uuid)',
    'public.my_groups()',
    'public.regenerate_group_code(uuid)',
    'public.remove_group_member(uuid, uuid)',
    'public.room_snapshot(uuid)',
    'public.start_race(uuid)',
    'public.is_group_member(uuid)',
    'public.is_race_participant(uuid)',
    'public.race_topic_allowed(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- `leaderboard(...)` stays public (granted to anon and authenticated in its own migration).

-- Functions created from now on are private until a migration grants them.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Per-user request window for the write Edge Functions
-- ---------------------------------------------------------------------------------------------

-- Not exposed through the Data API: nothing here is for clients to read.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.request_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  at timestamptz not null default now()
);

create index request_log_user_bucket_at_idx on private.request_log (user_id, bucket, at);

/**
 * Records one request and says whether it fits: at most `p_limit` per `p_window` per user and
 * bucket. Called by `submit-attempt` and `finish-race` with the service role before any work.
 * The caller's own stale rows are trimmed on the way, so the table stays the size of one window.
 */
create function public.consume_request_quota(
  p_user uuid,
  p_bucket text,
  p_limit integer default 60,
  p_window interval default interval '10 minutes'
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  recent integer;
begin
  -- One user's requests queue behind each other, so two parallel calls cannot both take the last
  -- slot.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_bucket, 0));

  delete from private.request_log r
  where r.user_id = p_user and r.bucket = p_bucket and r.at < now() - p_window;

  select count(*) into recent from private.request_log r
  where r.user_id = p_user and r.bucket = p_bucket;

  if recent >= p_limit then return false; end if;

  insert into private.request_log (user_id, bucket) values (p_user, p_bucket);
  return true;
end;
$$;

revoke execute on function public.consume_request_quota(uuid, text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.consume_request_quota(uuid, text, integer, interval) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Guest nicks: «Гість-NNNN», unique, for anyone who signs up without choosing one
-- ---------------------------------------------------------------------------------------------

create function private.guest_nick() returns text
language plpgsql volatile set search_path = '' as $$
declare
  candidate text;
  digits integer := 4;
begin
  for attempt in 1..60 loop
    -- Four digits while they last, then six: the space never runs out, the name stays short.
    if attempt > 30 then digits := 6; end if;
    candidate := 'Гість-' || lpad(floor(random() * power(10, digits))::bigint::text, digits, '0');
    if not exists (select 1 from public.profiles p where lower(p.nickname) = lower(candidate)) then
      return candidate;
    end if;
  end loop;
  return 'Гість-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
end;
$$;

revoke execute on function private.guest_nick() from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  chosen text;
  testing boolean := coalesce(new.raw_user_meta_data ->> 'is_test', '') = 'true';
begin
  if wanted is null or char_length(wanted) < 2 then
    chosen := private.guest_nick();
  else
    chosen := left(wanted, 32);
    -- Deterministic suffix from the user id, so a retried sign-up lands on the same name.
    if exists (select 1 from public.profiles p where lower(p.nickname) = lower(chosen)) then
      chosen := left(wanted, 27) || '-' || substr(replace(new.id::text, '-', ''), 1, 4);
    end if;
  end if;

  insert into public.profiles (id, nickname, is_test) values (new.id, chosen, testing)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Backfill: the old fallback name was `typist-<8 hex>`; give those profiles a guest nick.
do $$
declare
  target uuid;
begin
  for target in
    select p.id from public.profiles p where p.nickname ~ '^typist-[0-9a-f]{8}$'
  loop
    update public.profiles set nickname = private.guest_nick() where id = target;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Account deletion: owned groups pass to their oldest other member, or go when empty
-- ---------------------------------------------------------------------------------------------

/**
 * Called by the `delete-account` Edge Function (service role) and by the anonymous purge before
 * the auth user is removed. Without it the `groups.owner_id` cascade would delete a group from
 * under its remaining members.
 */
create function public.hand_over_owned_groups(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owned uuid;
  heir uuid;
begin
  for owned in select g.id from public.groups g where g.owner_id = p_user loop
    select m.user_id into heir from public.group_members m
    where m.group_id = owned and m.user_id <> p_user
    order by m.joined_at, m.user_id
    limit 1;

    if heir is null then
      delete from public.groups g where g.id = owned;
    else
      update public.groups g set owner_id = heir where g.id = owned;
      update public.group_members m set role = 'owner'
      where m.group_id = owned and m.user_id = heir;
    end if;
  end loop;
end;
$$;

revoke execute on function public.hand_over_owned_groups(uuid) from public, anon, authenticated;
grant execute on function public.hand_over_owned_groups(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. Daily purge of anonymous users with no activity for 30 days
-- ---------------------------------------------------------------------------------------------

/**
 * Activity is the latest of: account creation, sign-in, session refresh, attempt, race finish,
 * race join and group join. Deleting the auth user cascades through every table.
 */
create function private.purge_inactive_anonymous_users(p_idle interval default interval '30 days')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  removed integer := 0;
  cutoff timestamptz := now() - p_idle;
begin
  for target in
    select u.id from auth.users u
    where u.is_anonymous
      and greatest(u.created_at, u.last_sign_in_at, u.updated_at) < cutoff
      and not exists (select 1 from auth.sessions s where s.user_id = u.id
                      and greatest(s.created_at, s.updated_at, s.refreshed_at) >= cutoff)
      and not exists (select 1 from public.attempts a where a.user_id = u.id and a.created_at >= cutoff)
      and not exists (select 1 from public.race_results r where r.user_id = u.id and r.finished_at >= cutoff)
      and not exists (select 1 from public.race_participants p where p.user_id = u.id and p.joined_at >= cutoff)
      and not exists (select 1 from public.group_members m where m.user_id = u.id and m.joined_at >= cutoff)
  loop
    perform public.hand_over_owned_groups(target);
    delete from auth.users u where u.id = target;
    removed := removed + 1;
  end loop;
  return removed;
end;
$$;

revoke execute on function private.purge_inactive_anonymous_users(interval) from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- 03:17 UTC daily, off the hour so it does not queue behind everyone else's jobs.
select cron.schedule(
  'purge-inactive-anonymous-users',
  '17 3 * * *',
  $$select private.purge_inactive_anonymous_users()$$
);
