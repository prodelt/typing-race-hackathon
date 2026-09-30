-- F2 core: profiles, attempts, keystroke logs and derived progress.
--
-- The shape is ticket 21's, and two of its decisions are what the whole file is arranged around.
--
-- 1. **Attempts are append-only and clients cannot insert them.** Every write goes through the
--    `submit-attempt` Edge Function, which recomputes every metric from the keystroke log by
--    importing the same `packages/metrics` and `packages/curriculum` the browser used
--    (ADR-0007). A client number is a claim, not a measurement, and a leaderboard built on
--    claims is a leaderboard built on nothing.
-- 2. **Progress is derived, never authored.** It is a fold over attempt aggregates in
--    `completed_at` order, re-run on every insert, so an outbox that drains out of order after a
--    week offline still lands on the same answer (ADR-0005).
--
-- Row-level security is on for every table here, and the policies are deliberately narrow:
-- `select` your own rows, and almost nothing else. Other learners' nicknames become visible only
-- through leaderboards and groups, which later migrations add with their own policies.

-- ---------------------------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Mandatory, because a leaderboard needs a name and an empty one is a worse experience than
  -- being asked for it once (ticket 13). No avatars: no third-party image host, nothing to moderate.
  nickname text not null check (char_length(nickname) between 2 and 32),
  interface_language text not null default 'uk' check (interface_language in ('uk', 'en')),
  -- Preview and CI accounts. They practise and race normally but never appear on a leaderboard,
  -- so a smoke test cannot pollute the board a jury looks at (ticket 15).
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index profiles_nickname_key on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- The profile is created by a trigger rather than by the client, so a learner can never exist
-- without one — every later table's foreign key depends on that being true.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      -- A deterministic fallback rather than a random one, so a retry of the same sign-up does
      -- not produce a second name.
      'typist-' || substr(replace(new.id::text, '-', ''), 1, 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- attempts
-- ---------------------------------------------------------------------------------------------

create table public.attempts (
  -- **Client-generated UUID.** This is what makes the outbox idempotent: a retry after a dropped
  -- response collides on the primary key and is discarded, rather than counting the attempt twice.
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scale_id text not null,
  layout_id text not null check (layout_id in ('yq', 'qwerty')),
  language text not null check (language in ('uk', 'en')),
  mode text not null check (mode in ('practice', 'test')),
  seed bigint not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  -- Recomputed server-side from the log. Never the client's numbers.
  metrics jsonb not null,
  -- Per key and per transition: count, misses, sum and sum of squares of timing. Kept **forever**,
  -- which is what makes deleting the keystroke logs safe.
  aggregates jsonb not null,
  -- Which built `data/derived/` produced the exercise, so a replay knows what it is replaying.
  data_version text,
  created_at timestamptz not null default now(),

  constraint attempts_completed_after_start check (completed_at >= started_at)
);

create index attempts_user_completed_idx
  on public.attempts (user_id, completed_at);

alter table public.attempts enable row level security;

-- Read your own. **No insert, update or delete policy exists at all**, so the only writer is the
-- Edge Function running with the service role. That absence is the security control; adding a
-- permissive insert policy here would quietly undo ADR-0007.
create policy attempts_select_own on public.attempts
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- keystroke_logs
-- ---------------------------------------------------------------------------------------------

-- Their own table, not a column on `attempts`, because they are the one thing that gets deleted.
-- Retention keeps the 20 most recent per learner (FR-081); pruning drops rows here and touches
-- nothing that any derived value reads (SC-019).
create table public.keystroke_logs (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Old logs stay replayable after the encoding changes.
  format_version integer not null,
  -- The compact parallel-array shape: deltas in ms, event kinds, characters, correctness.
  -- About 1.5 KB for a 150-character exercise.
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index keystroke_logs_user_created_idx
  on public.keystroke_logs (user_id, created_at desc);

alter table public.keystroke_logs enable row level security;

create policy keystroke_logs_select_own on public.keystroke_logs
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- progress
-- ---------------------------------------------------------------------------------------------

create table public.progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- One progress per language (FR-051): a learner's Ukrainian ladder and English ladder are
  -- different ladders, and averaging them would make both meaningless.
  language text not null check (language in ('uk', 'en')),
  -- Bumped when the fold itself changes, so a snapshot written by an older deploy is detectable
  -- rather than silently trusted.
  derived_version integer not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),

  primary key (user_id, language)
);

alter table public.progress enable row level security;

create policy progress_select_own on public.progress
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------------------------

-- FR-081, as a function so both the nightly job and a test can call it. It deletes only
-- `keystroke_logs`; aggregates and history are untouched, which is precisely why the rule is
-- safe to run unattended.
create function public.prune_keystroke_logs(keep_per_user integer default 20)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  with ranked as (
    select
      l.attempt_id,
      row_number() over (partition by l.user_id order by a.completed_at desc) as rank
    from public.keystroke_logs l
    join public.attempts a on a.id = l.attempt_id
  )
  delete from public.keystroke_logs l
  using ranked r
  where l.attempt_id = r.attempt_id and r.rank > keep_per_user;

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_keystroke_logs is
  'FR-081: keeps the most recent logs per learner. Deletes nothing a derived value reads (SC-019).';
