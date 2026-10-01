-- Settings follow the Account (ADR-0006): last-write-wins by `settings_updated_at`.
--
-- On the profile rather than a table of their own: one row per learner, written only by that
-- learner through `profiles_update_own`, and never shown to anyone else (profiles are select-own;
-- only the nick reaches other learners, through boards and rooms). The client writes conditionally
-- (`settings_updated_at < new stamp`), and the trigger below enforces the same rule in the
-- database, so a stale device cannot overwrite a newer copy even if it skips the filter.
--
-- Idempotent: safe to apply on top of the live schema, and again.

alter table public.profiles
  add column if not exists settings jsonb,
  add column if not exists settings_updated_at timestamptz;

-- An object, and a small one: the app's settings are a dozen flags, and a profile row is read by
-- every board and room query that joins it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_settings_shape' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_settings_shape check (
        settings is null
        or (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192)
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Last write wins, in the database
-- ---------------------------------------------------------------------------------------------

/**
 * Keeps the stored settings when an update carries an older (or no) stamp than the row already
 * has. Other columns of the same update (a nick change) go through untouched.
 */
create or replace function public.profiles_settings_lww() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.settings_updated_at is not null
     and (new.settings_updated_at is null or new.settings_updated_at < old.settings_updated_at) then
    new.settings := old.settings;
    new.settings_updated_at := old.settings_updated_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_settings_lww() from public, anon, authenticated;

drop trigger if exists profiles_settings_lww on public.profiles;
create trigger profiles_settings_lww
  before update on public.profiles
  for each row execute function public.profiles_settings_lww();

-- ---------------------------------------------------------------------------------------------
-- RLS and grants: own row only, and only the columns a learner may change
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Profiles are created by `handle_new_user` and removed with the auth user; nobody writes them
-- directly but their owner, and the owner only these columns. `is_test` stays guarded by its own
-- trigger as well; `id` and `created_at` are no longer writable at all.
revoke insert, update, delete, truncate on public.profiles from anon;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (nickname, interface_language, settings, settings_updated_at)
  on public.profiles to authenticated;
