-- Settings follow the Account (ADR-0006): last-write-wins by `settings_updated_at`.
--
-- On the profile rather than a table of their own: one row per learner, written only by that
-- learner through the existing `profiles_update_own` policy, and never shown to anyone else
-- (profiles are select-own). The client writes conditionally (`settings_updated_at < new stamp`),
-- so a stale device cannot overwrite a newer copy.

alter table public.profiles
  add column if not exists settings jsonb,
  add column if not exists settings_updated_at timestamptz;
