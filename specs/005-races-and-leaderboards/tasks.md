---

description: "Task list for F5 005-races-and-leaderboards (compact package, ADR-0010)"
---

# Tasks: Races and Leaderboards (F5)

**Input**: [spec.md](./spec.md). Decisions live in tickets
[14](../../.scratch/typing-race-hackathon/issues/14-races-and-group-leaderboards.md),
[21](../../.scratch/typing-race-hackathon/issues/21-system-design-and-data-model.md) and
[05](../../.scratch/typing-race-hackathon/issues/05-supabase-vercel-free-tier-research.md), and ADRs
[0006](../../docs/adr/0006-race-authority-broadcast-for-display-edge-function-for-truth.md) and
[0007](../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md).

**Tests**: required. Test tasks precede their implementation; property tests are mandatory for scoring,
replay and the race reducer.

**Gates ([ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md))**: everything on `main`; a
task closes on green `pnpm typecheck`, `pnpm lint`, `pnpm test`; Playwright on Chromium during work, in
full at the end.

## Format: `- [ ] Tnnn [P?] [USn] Description in path (FR-nnn)`

`[P]`: paths do not overlap. Hot files change only in phases 1 and 2. F5 starts after F2 is on `main`.

## Ownership

| Phase | Owns |
|---|---|
| 1 + 2 | hot files, `packages/{domain,contracts}/**`, `packages/metrics/src/race*`, `supabase/migrations/2026093015*`, `supabase/tests/support/**`, `apps/web/src/{app,seams}/**`, `apps/web/src/sync/{index,memory-race}.ts`, `tools/**`, `data/curriculum/*/race-texts.json` |
| US1 | `supabase/migrations/2026093016*`, `apps/web/src/features/groups/**`, `e2e/groups.spec.ts` |
| US2 | `supabase/migrations/2026093017*`, `apps/web/src/sync/race-room.ts`, `apps/web/src/features/races/{Room*,Lobby*,Countdown*}`, `e2e/room.spec.ts` |
| US3 | `supabase/functions/finish-race/**`, `apps/web/src/sync/race-progress.ts`, `apps/web/src/features/races/{Race*,Lanes*,Result*,machine*}`, `e2e/race.spec.ts` |
| US4 | `supabase/migrations/2026093018*`, `apps/web/src/features/leaderboards/**`, `e2e/leaderboards.spec.ts` |
| US5 | `supabase/migrations/2026093019*`, `apps/web/src/features/races/{QuickMatch*,Spectator*}`, `e2e/quickmatch.spec.ts` |

---

## Phase 1: Setup

- [ ] T001 Fetch current docs with `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` for Supabase
  Realtime (private channels, `realtime.messages` RLS, `realtime.send()`, Presence) and `pg_cron`
  time zones; note contradictions in `specs/005-races-and-leaderboards/notes.md` (FR-005, FR-006, FR-024)
- [ ] T002 [P] Register message catalogues `groups`, `leaderboards` and extend `races` in
  `apps/web/project.inlang/settings.json`
- [ ] T003 [P] Enable the Races and Leaderboards navigation items in `apps/web/src/app/Shell.tsx`
- [ ] T004 Add `/races`, `/races/$roomId`, `/groups`, `/groups/$groupId`, `/leaderboards` routes behind
  the guard in `apps/web/src/app/router.tsx` (FR-034)
- [ ] T005 Extend `.github/workflows/deploy-backend.yml` to seed `race_texts` with the `content_hash`
  check (FR-014)

**Checkpoint**: install, typecheck, lint green; routes render placeholders behind sign-in.

---

## Phase 2: Foundational

### Tables, RLS and Realtime

- [ ] T006 Migration for `groups`, `group_members` with RLS (members only) in
  `supabase/migrations/20260930150000_groups.sql` (FR-021, FR-027)
- [ ] T007 Migration for `race_texts`, `race_rooms`, `race_participants`, `race_results` with RLS for
  participants in `supabase/migrations/20260930150100_races.sql` (FR-008, FR-013, FR-014)
- [ ] T008 Migration for `lb_weekly`, `lb_global`, `group_practice` summary tables in
  `supabase/migrations/20260930150200_leaderboards.sql` (FR-022)
- [ ] T009 Migration for RLS on `realtime.messages` so only a room's participants use `race:{roomId}`, in
  `supabase/migrations/20260930150300_realtime_rls.sql` (FR-005)
- [ ] T010 RLS allowed and denied tests for every new table in `supabase/tests/rls-races.test.ts`
  (FR-033)

### Contracts, scoring, replay

- [ ] T011 Zod schemas for `finish-race` request and response, the `progress {u,i,e,t}` and
  `state {state,startsAt}` broadcasts and typed rejection reasons in `packages/contracts/src/race.ts` and
  its barrel (FR-003, FR-006, FR-016, FR-020)
- [ ] T012 Race types (`RoomState`, `RaceResult`, `Board`) in `packages/domain/src/index.ts` (FR-008)
- [ ] T013 Tests first: same log and text give the same verdict and score; a log that cannot produce the
  text is rejected; score is monotone in accuracy, in `packages/metrics/src/race.test.ts` (FR-016,
  FR-018; SC-005)
- [ ] T014 Replay and accuracy-weighted score as pure exports in `packages/metrics/src/race.ts`; resolve
  the score-formula decision first (FR-016, FR-018)
- [ ] T015 Extend the Deno check to cover the new `packages/metrics` exports in `.github/workflows/ci.yml`
  (FR-016)

### Race texts and client seams

- [ ] T016 Author or select race texts of about 300 characters per language and difficulty in
  `data/curriculum/{uk,en}/race-texts.json`; resolve the source and difficulty decisions first (FR-014)
- [ ] T017 Seed `race_texts` with a `content_hash` check in `tools/seed-race-texts.ts` (FR-014)
- [ ] T018 Extend the `sync` interface with `race(roomId)` returning an event emitter in
  `apps/web/src/sync/index.ts` (FR-029)
- [ ] T019 In-memory race adapter, able to simulate N racers and a forged message, in
  `apps/web/src/sync/memory-race.ts` (FR-029)
- [ ] T020 Test helper that seeds a room in any state through RPC, for stories that must not import each
  other, in `supabase/tests/support/rooms.ts` (FR-033)

**Checkpoint**: `pnpm test` green; migrations apply to local Supabase; RLS tests pass.

---

## Phase 3: User Story 1 - Groups (P1)

**Independent Test**: A creates a group, B joins by code, both see members, practice columns show, a
non-member is denied.

- [ ] T021 [US1] E2E for scenarios 1–5 in `e2e/groups.spec.ts` (FR-021, FR-023, FR-027)
- [ ] T022 [US1] RPCs `create_group`, `join_group`, `leave_group` with code generation and the
  `group_practice` trigger in `supabase/migrations/20260930160000_group_rpcs.sql` (FR-021, FR-022)
- [ ] T023 [P] [US1] RPC tests, allowed and denied, in `supabase/tests/groups.test.ts` (FR-033)
- [ ] T024 [US1] Groups list and create or join in `apps/web/src/features/groups/GroupsScreen.tsx`
  (FR-021)
- [ ] T025 [US1] Group page with members and the practice board in
  `apps/web/src/features/groups/GroupPage.tsx` (FR-023)
- [ ] T026 [P] [US1] Strings in `apps/web/messages/groups/uk.json` and `en.json`

---

## Phase 4: User Story 2 - A private room to a synchronised start (P1)

**Independent Test**: two contexts; create, join by code and link, start; identical countdown; a forged
`state` ignored.

- [ ] T027 [US2] E2E for scenarios 1–5 in `e2e/room.spec.ts`, two browser contexts (FR-006, FR-007,
  FR-009, FR-033)
- [ ] T028 [US2] RPCs `create_room`, `join_by_code`, `start_race` (sets `starts_at = now() + 3 s` and calls
  `realtime.send()`), returning server `now()`, in
  `supabase/migrations/20260930170000_room_rpcs.sql` (FR-006, FR-007, FR-009, FR-010)
- [ ] T029 [P] [US2] RPC and forged-message tests in `supabase/tests/rooms.test.ts` (FR-006, FR-013)
- [ ] T030 [US2] Supabase room adapter: join, Presence roster, state subscription, clock offset, in
  `apps/web/src/sync/race-room.ts` (FR-005, FR-007)
- [ ] T031 [US2] Lobby with code and invite link in `apps/web/src/features/races/Lobby.tsx` (FR-010)
- [ ] T032 [US2] Room screen with the gathering state in `apps/web/src/features/races/RoomScreen.tsx`
  (FR-031)
- [ ] T033 [US2] 3-2-1 countdown against `starts_at` in `apps/web/src/features/races/Countdown.tsx`
  (FR-009)
- [ ] T034 [P] [US2] Strings extending `apps/web/messages/races/uk.json` and `en.json`

---

## Phase 5: User Story 3 - Race to a validated result (P1)

**Independent Test**: seeded running room; two finish; validating then validated; tampered log rejected;
88% unranked.

- [ ] T035 [US3] E2E for scenarios 1–6 in `e2e/race.spec.ts` (FR-003, FR-016, FR-018, FR-019, FR-032)
- [ ] T036 [US3] Tests first: race reducer transitions and invariants as properties, in
  `apps/web/src/features/races/machine.test.ts` (FR-030)
- [ ] T037 [US3] Race reducer in `apps/web/src/features/races/machine.ts` (FR-030)
- [ ] T038 [US3] `finish-race` function: authenticate, replay with `metrics` unchanged, plausibility,
  write `race_results`, broadcast the final state through the database, in
  `supabase/functions/finish-race/index.ts` (FR-016, FR-017, FR-020)
- [ ] T039 [P] [US3] Integration tests: valid, tampered, below floor, replayed twice, in
  `supabase/tests/finish-race.test.ts` (FR-016, FR-018, FR-033)
- [ ] T040 [US3] Progress broadcaster at a single rate constant in
  `apps/web/src/sync/race-progress.ts` (FR-002, FR-003, FR-004)
- [ ] T041 [US3] Lanes with forward-only interpolation and a static three-line text block in
  `apps/web/src/features/races/Lanes.tsx` and `RaceText.tsx` (FR-003, FR-015, FR-032)
- [ ] T042 [US3] Race screen wiring the engine to the room in
  `apps/web/src/features/races/RaceScreen.tsx` (FR-031)
- [ ] T043 [US3] Validating state with per-player rows, then the result with finish order, score and the
  honest live-positions note, in `apps/web/src/features/races/ResultView.tsx` (FR-018, FR-019, FR-031)

---

## Phase 6: User Story 4 - Leaderboards (P1)

**Independent Test**: seeded validated results; boards correct; below-floor and `is_test` absent; weekly
empty after reset.

- [ ] T044 [US4] E2E for scenarios 1–5 in `e2e/leaderboards.spec.ts` (FR-022, FR-025, FR-026)
- [ ] T045 [US4] Triggers maintaining `lb_weekly`, `lb_global`, excluding below-floor and `is_test`, in
  `supabase/migrations/20260930180000_lb_triggers.sql` (FR-017, FR-022, FR-026)
- [ ] T046 [US4] Weekly reset via `pg_cron` at Monday 00:00 Kyiv time in
  `supabase/migrations/20260930180100_lb_cron.sql` (FR-024)
- [ ] T047 [P] [US4] Trigger, exclusion and reset tests in `supabase/tests/leaderboards.test.ts` (FR-024,
  FR-026; SC-006, SC-007)
- [ ] T048 [P] [US4] Board reads with a 60 s TanStack Query cache in
  `apps/web/src/features/leaderboards/useBoard.ts` (FR-025)
- [ ] T049 [US4] Group, weekly and global tabs in
  `apps/web/src/features/leaderboards/LeaderboardsScreen.tsx`, naming nothing a "global rating" unless
  server-backed (FR-022, FR-028)
- [ ] T050 [P] [US4] Strings in `apps/web/messages/leaderboards/uk.json` and `en.json`

---

## Phase 7: User Story 5 - Quick match and spectators (P2)

**Independent Test**: six contexts; five race, one spectates; an idle racer is moved at 30 s.

- [ ] T051 [US5] E2E for scenarios 1–4 in `e2e/quickmatch.spec.ts` (FR-011, FR-012, FR-033)
- [ ] T052 [US5] `join_quick_match(lang, difficulty)` with a row lock and the idle-to-spectator rule in
  `supabase/migrations/20260930190000_quick_match.sql`; implement the decided behaviour at the ceiling
  (FR-011, FR-012, FR-001)
- [ ] T053 [P] [US5] Concurrency test: parallel callers never overfill a room, in
  `supabase/tests/quick-match.test.ts` (FR-011)
- [ ] T054 [US5] Quick-match picker in `apps/web/src/features/races/QuickMatch.tsx` (FR-011)
- [ ] T055 [US5] Spectator view, no progress sent, in `apps/web/src/features/races/Spectator.tsx`
  (FR-012)

---

## Phase 8: Polish and cross-cutting

- [ ] T056 Measure Realtime throughput with N simulated rooms to settle sends versus deliveries and
  record the real ceiling, in `tools/realtime-load.ts` and `specs/005-races-and-leaderboards/notes.md`
  (FR-001, FR-004)
- [ ] T057 Nightly E2E against production with test accounts to catch real Realtime limits, in
  `.github/workflows/nightly.yml` (FR-001)
- [ ] T058 Add the honest anti-cheat statement, in Ukrainian, to `README.md` (FR-019)
- [ ] T059 Full Playwright matrix on Chromium, Firefox and WebKit (DoD)
- [ ] T060 [P] axe and Lighthouse on the room, result and boards
- [ ] T061 [P] Align `CONTEXT.md`'s race states with the database names (`gathering`, `running`) and add
  Spectator budget notes
- [ ] T062 Trace FR-001…FR-034 to tasks and tests; list gaps in `specs/005-races-and-leaderboards/notes.md`
- [ ] T063 Set F5 `Status` to built in `specs/roadmap.md`

## Notes

- 63 tasks: 5 setup, 15 foundational, 6 US1, 8 US2, 9 US3, 7 US4, 5 US5, 8 polish.
- Suggested fan-out: US1 and US2 together (disjoint trees), then US3 and US4, then US5.
