---

description: "Task list for F2 002-accounts-and-progress (compact package, ADR-0010)"
---

# Tasks: Accounts and Progress (F2)

**Input**: [spec.md](./spec.md). There is no separate plan, research or data-model file: the decisions
live in tickets [13](../../.scratch/typing-race-hackathon/issues/13-accounts-sync-privacy.md) and
[21](../../.scratch/typing-race-hackathon/issues/21-system-design-and-data-model.md) and ADRs
[0002](../../docs/adr/0002-mandatory-authentication.md),
[0005](../../docs/adr/0005-append-only-attempts-as-source-of-truth.md),
[0007](../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md).

**Tests**: required. Constitution principle II makes tests first-class; test tasks precede their
implementation. Property tests are mandatory for the fold and for anything touching accuracy.

**Gates ([ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md))**: everything runs on
`main`; a task closes on green `pnpm typecheck`, `pnpm lint`, `pnpm test`; Playwright on Chromium
during work and in full at the end.

## Format: `- [ ] Tnnn [P?] [USn] Description in path (FR-nnn)`

`[P]`: paths do not overlap, so the task may run beside other `[P]` tasks. `[USn]`: Setup,
Foundational and Polish carry no label. Hot files (`package.json`, lockfile, `tsconfig*`, `vitest`,
`playwright`, Biome, CI, router, barrels, `supabase/config.toml`) change **only** in phases 1 and 2.

## Ownership (disjoint trees, so subagents never collide)

| Phase | Owns |
|---|---|
| 1 + 2 | hot files, `packages/contracts/**`, `supabase/migrations/2026093012*`, `supabase/tests/support/**`, `apps/web/src/app/**`, `apps/web/src/seams/**`, `apps/web/src/sync/{index,client,memory}.ts` |
| US1 | `apps/web/src/features/auth/**`, `apps/web/src/sync/auth.ts`, `e2e/auth.spec.ts`, `apps/web/messages/auth/**` |
| US2 | `supabase/functions/submit-attempt/**`, `supabase/migrations/2026093013*`, `supabase/tests/submit-attempt*`, `supabase/tests/rls*` |
| US3 | `apps/web/src/sync/{supabase,outbox,badge}*`, `apps/web/src/features/sync-status/**`, `e2e/sync.spec.ts` |
| US4 | `apps/web/src/features/history/**`, `e2e/history.spec.ts`, `apps/web/messages/history/**` |
| US5 | `supabase/functions/delete-account/**`, `apps/web/src/features/{privacy,profile}/**`, `e2e/privacy.spec.ts`, `apps/web/messages/{privacy,profile}/**` |

---

## Phase 1: Setup (toolchain and hot files)

- [ ] T001 Fetch current docs with `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` for supabase-js 2
  (PKCE, `onAuthStateChange`, offline refresh), Supabase Edge Functions (Deno, `jsr:` imports),
  `pg_cron`, and Zod; record anything contradicting the tickets in `specs/002-accounts-and-progress/notes.md`
- [ ] T002 Create the pure `packages/contracts/` package (`package.json`, `tsconfig.json` extending the
  pure base, Vitest `node` project in `vitest.config.ts`) — resolves the Zod-location open decision
  (FR-019)
- [ ] T003 [P] Add `@supabase/supabase-js` to `apps/web/package.json` and `zod` to
  `packages/contracts/package.json`; refresh the lockfile
- [ ] T004 [P] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only to `.env.example` (FR-034)
- [ ] T005 Configure Auth in `supabase/config.toml`: confirmations off, PKCE, Google and GitHub from env
  references, raised per-IP sign-up limits, custom SMTP for resets only (FR-001, FR-002, FR-003)
- [ ] T006 Add a Biome rule forbidding `supabase.from(` and `createClient(` outside `apps/web/src/sync/`
  in `biome.json` (FR-022)
- [ ] T007 Add a Vitest `integration` project against local Supabase, with `supabase/tests/support/users.ts`
  creating one user per test through `admin.createUser({email_confirm: true})`, in `vitest.config.ts`
  (FR-033)
- [ ] T008 Extend `.github/workflows/ci.yml` with `supabase start -x <unused services>`, the integration
  project, and a `deno check` job over `packages/metrics` and `packages/curriculum` (FR-012, FR-031)
- [ ] T009 [P] Add `.github/workflows/deploy-backend.yml`: on push to `main`, `supabase db push`, function
  deploy, production smoke (FR-032)
- [ ] T010 [P] Add `.github/workflows/keepalive.yml`: ping the project every 3 days (FR-032)
- [ ] T011 [P] Register new message catalogues in `apps/web/project.inlang/settings.json`: `auth`,
  `history`, `privacy`, `profile`

**Checkpoint**: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `supabase start` and the empty
integration project all succeed.

---

## Phase 2: Foundational (blocking prerequisites)

- [ ] T012 Review the draft `supabase/migrations/20260930120000_core.sql` against FR-007, FR-009, FR-017
  and FR-018; list deltas in `specs/002-accounts-and-progress/notes.md` (FR-009)
- [ ] T013 [P] Write Zod schemas `SubmitAttemptRequest`, `SubmitAttemptResponse`, the typed
  `RejectionReason` union and `DeleteAccountResponse` in `packages/contracts/src/submit-attempt.ts` (FR-010,
  FR-014, FR-019)
- [ ] T014 [P] Write the versioned export format schema in `packages/contracts/src/export.ts` (FR-029)
- [ ] T015 Barrel `packages/contracts/src/index.ts` and schema round-trip tests in
  `packages/contracts/src/contracts.test.ts` (FR-019)
- [ ] T016 Migration adding profile `layout_id`, `typing_language`, `settings jsonb`, and a
  forward-only `set_starting_level(language, choice)` RPC, in
  `supabase/migrations/20260930120100_profile_settings.sql` (FR-026)
- [ ] T017 Define the `sync` interface (`submitAttempt`, `progress`, `pendingCount`, `status`) types-only
  in `apps/web/src/sync/index.ts`, leaving `race()` as a stub F5 fills (FR-022)
- [ ] T018 [P] In-memory `sync` adapter in `apps/web/src/sync/memory.ts` so UI stories seed without Docker
  (FR-022)
- [ ] T019 [P] The one Supabase client factory, PKCE on, in `apps/web/src/sync/client.ts` (FR-002)
- [ ] T020 IndexedDB per-user cache (`outbox`, `progress`, `recent-attempts`) in
  `apps/web/src/seams/user-cache.ts`, because the lint rule keeps IndexedDB inside `seams/` (FR-023)
- [ ] T021 Route guard and auth state: public allow-list (product, formulas, licences, privacy, about,
  sign-in/up/reset), everything else redirected, nickname gate, in `apps/web/src/app/guard.tsx` and
  `apps/web/src/app/router.tsx` (FR-005, FR-004)
- [ ] T022 Mount a `SyncBadge` slot in the shell `apps/web/src/app/Shell.tsx` and the History, Profile and
  Sign-in routes in `apps/web/src/app/router.tsx` (FR-024, FR-027)
- [ ] T023 Mark the VII waiver lapsed in `specs/001-typing-core/plan.md` § Waiver and remove the
  preview-only restriction from `AGENTS.md` if present (FR-006)
- [ ] T024 Contract-suite registration point: add the `supabaseStore` entry to the `adapters` list in
  `apps/web/src/seams/store.contract.test.ts` **without editing a single assertion** (FR-021)

**Checkpoint**: typecheck, lint and unit tests green; Docker stack up; contracts tested.

---

## Phase 3: User Story 1 - Sign up, sign in, choose a nickname (P1)

**Independent Test**: fresh browser — create a profile, set a nickname, reach Today; sign out; `/path`
redirects to sign-in while `/formulas` renders.

- [ ] T025 [US1] E2E for scenarios 1–7 in `e2e/auth.spec.ts`, including an axe pass and keyboard-only
  operation (FR-001, FR-002, FR-004, FR-005, FR-008)
- [ ] T026 [US1] Auth helpers (`signUp`, `signIn`, `signInWithOAuth`, `resetPassword`, `setNickname`,
  `signOut`) in `apps/web/src/sync/auth.ts`, with a unit test for the nickname-taken error (FR-001,
  FR-004)
- [ ] T027 [P] [US1] Sign-in and sign-up forms in `apps/web/src/features/auth/SignIn.tsx` and
  `apps/web/src/features/auth/SignUp.tsx` (FR-001)
- [ ] T028 [P] [US1] Google and GitHub buttons in `apps/web/src/features/auth/OAuthButtons.tsx` (FR-002)
- [ ] T029 [P] [US1] Nickname and interface-language step in `apps/web/src/features/auth/Nickname.tsx`
  (FR-004)
- [ ] T030 [P] [US1] Password reset request and set screens in `apps/web/src/features/auth/Reset.tsx` (FR-003)
- [ ] T031 [US1] Sign-out dialog warning on a non-empty outbox in
  `apps/web/src/features/auth/SignOutDialog.tsx`, then clearing the cache (FR-008)
- [ ] T032 [P] [US1] Ukrainian and English strings in `apps/web/messages/auth/uk.json` and `en.json` (FR-001)

---

## Phase 4: User Story 2 - The server judges every attempt (P1)

**Independent Test**: integration test as two users — valid, tampered, implausible, duplicate,
out-of-order; direct insert denied.

- [ ] T033 [US2] Integration tests for scenarios 1–7 in `supabase/tests/submit-attempt.test.ts` (FR-010,
  FR-011, FR-014, FR-015)
- [ ] T034 [P] [US2] RLS denial tests, allowed and denied, for every table in `supabase/tests/rls.test.ts`
  (FR-009, FR-033)
- [ ] T035 [P] [US2] Property test: any permutation of any attempt set folds to identical progress, in
  `supabase/tests/fold-order.property.test.ts` (FR-017)
- [ ] T036 [US2] Decide and apply the plausibility limits as constants with unit tests in
  `supabase/functions/submit-attempt/plausibility.ts` and `plausibility.test.ts` (FR-013)
- [ ] T037 [US2] Atomic write as a `security definer` RPC `submit_attempts` in
  `supabase/migrations/20260930130000_submit_attempts.sql` — attempt, log, aggregates, progress in one
  transaction, `on conflict do nothing` (FR-015, FR-016)
- [ ] T038 [US2] Rewrite the function around the Zod contract: validate, recompute with `metrics` and
  `curriculum` unchanged, derive progress for **every** language in the batch, return typed rejections, in
  `supabase/functions/submit-attempt/index.ts` (FR-010, FR-011, FR-014, FR-017, FR-019)
- [ ] T039 [US2] AFK exclusion and flagging and per-user rate limit in
  `supabase/functions/submit-attempt/afk.ts` (FR-013)
- [ ] T040 [US2] Nightly 30-day log pruning via `pg_cron` in
  `supabase/migrations/20260930130100_retention_cron.sql`; test pruning changes no derived value (FR-018)
- [ ] T041 [US2] Re-derive stale snapshots when `derived_version` is older than the code's in
  `supabase/functions/submit-attempt/rederive.ts` (FR-017)

---

## Phase 5: User Story 3 - Progress follows the learner (P1)

**Independent Test**: attempt, offline attempt, reload from cache, reconnect drains, second context
matches, sign-out warns.

- [ ] T042 [US3] E2E for scenarios 1–6 in `e2e/sync.spec.ts`, driving offline through the browser context
  (FR-022, FR-024, FR-025)
- [ ] T043 [P] [US3] `sync` contract suite over the in-memory and Supabase adapters in
  `apps/web/src/sync/sync.contract.test.ts` (FR-022)
- [ ] T044 [US3] Outbox: enqueue, drain on reconnect, split large batches, surface rejections, in
  `apps/web/src/sync/outbox.ts` (FR-025)
- [ ] T045 [US3] Supabase `sync` adapter in `apps/web/src/sync/supabase.ts`: cache first, refresh from the
  server, call `submit-attempt` (FR-022, FR-024)
- [ ] T046 [US3] Supabase `ProgressStore` adapter in `apps/web/src/sync/supabase-store.ts`, satisfying the
  contract suite unchanged; resolve the `clear()` and fixture decisions first (FR-021)
- [ ] T047 [P] [US3] `SyncBadge` in `apps/web/src/features/sync-status/SyncBadge.tsx` (FR-024)
- [ ] T048 [US3] Settings and starting-level sync through `set_starting_level` in
  `apps/web/src/sync/settings.ts` (FR-026)
- [ ] T049 [US3] Rejected-attempt notice in `apps/web/src/features/sync-status/Rejected.tsx` (FR-010)

---

## Phase 6: User Story 4 - History (P2)

**Independent Test**: seed 25 attempts over several days; list, daily chart and bests render; old ones
say the log is gone.

- [ ] T050 [US4] E2E for scenarios 1–4 in `e2e/history.spec.ts` (FR-027)
- [ ] T051 [P] [US4] View model and personal-best rule (accuracy first) with property tests in
  `apps/web/src/features/history/model.ts` and `model.test.ts` (FR-027)
- [ ] T052 [P] [US4] Hand-written SVG daily chart with a text alternative in
  `apps/web/src/features/history/DailyChart.tsx` (FR-027)
- [ ] T053 [US4] History page and list in `apps/web/src/features/history/HistoryPage.tsx`; reuse the F1
  result view for a single attempt (FR-027)
- [ ] T054 [P] [US4] Strings in `apps/web/messages/history/uk.json` and `en.json` (FR-027)

---

## Phase 7: User Story 5 - My data is mine (P2)

**Independent Test**: read Privacy signed out; export; delete; the learner cannot sign in and no rows
remain.

- [ ] T055 [US5] E2E for scenarios 1–5 in `e2e/privacy.spec.ts` (FR-028, FR-029, FR-030)
- [ ] T056 [P] [US5] Integration test: deletion cascades through every owned table, in
  `supabase/tests/delete-account.test.ts` (FR-020)
- [ ] T057 [US5] `delete-account` function returning 204 in `supabase/functions/delete-account/index.ts`
  (FR-020)
- [ ] T058 [P] [US5] Privacy page in plain language in `apps/web/src/features/privacy/PrivacyPage.tsx` and
  both message files (FR-028)
- [ ] T059 [P] [US5] Profile and data screen with export in
  `apps/web/src/features/profile/ProfilePage.tsx` and `export.ts` (FR-029, FR-030)
- [ ] T060 [US5] Import that submits through `sync.submitAttempt` so it is validated like a live attempt, in
  `apps/web/src/features/profile/import.ts`; resolve the log-less import decision first (FR-029)

---

## Phase 8: Polish and cross-cutting

- [ ] T061 Run the full Playwright matrix on Chromium, Firefox and WebKit and fix what differs (DoD)
- [ ] T062 [P] axe and Lighthouse pass on the sign-in, History and Privacy routes
- [ ] T063 [P] Add Outbox, Sync badge and Plausibility Check to `CONTEXT.md` glossary
- [ ] T064 [P] Secret scan over `supabase/` and workflows; confirm only public variables are committed
  (FR-034)
- [ ] T065 Trace every FR-001…FR-034 to a task and a test; list gaps in `specs/002-accounts-and-progress/notes.md`
- [ ] T066 Set F2 `Status` to built in `specs/roadmap.md`

## Notes

- 66 tasks: 11 setup, 13 foundational, 8 US1, 9 US2, 8 US3, 5 US4, 6 US5, 6 polish.
- Suggested fan-out: US2 (server, `supabase/`) and US1 (client, `features/auth`) are fully disjoint and
  start together; US3 follows once US2's contract is stable; US4 and US5 last.
