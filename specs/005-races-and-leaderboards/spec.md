# Feature Specification: Races and Leaderboards

**Feature ID**: F5 · **Feature Directory**: `specs/005-races-and-leaderboards`

**Status**: Compact package (ADR-0010) — spec and tasks only, no separate plan

**Input**: F5 `005-races-and-leaderboards` from [`specs/roadmap.md`](../roadmap.md). Every requirement
cites its ticket or ADR; nothing is newly decided. A gap is written `[NEEDS DECISION: …]`. Product rules
in `AGENTS.md` § Non-negotiable product rules are inherited, not restated.

## Summary

Learners race each other in live rooms and compare on group, weekly and global leaderboards. Live
positions are a **display**; the ranked result is **truth**: the start is anchored to a server
timestamp, progress is broadcast twice a second for display only, and an Edge Function replays the
keystroke log against the race text before any result is ranked ([ADR-0006][A6], narrowed in
[ticket 21][T21]). It requires accounts (F2).

**The design lives inside Realtime throughput, not connections.** The Free tier allows about 100
messages a second and 200 concurrent connections; at five racers and two updates a second that is
roughly **10–20 concurrent races**, and throughput is what binds ([research 05][R5], [ticket
05][T05]). A jury demo uses under 5% of it. Every choice below keeps a room's message budget explicit.

## Scope Boundary

**In F5.** Groups with join codes and roles; private-code rooms and quick match; the race state machine,
countdown and live lanes; spectators; the `finish-race` replay; accuracy-weighted ranking; group, weekly
and global leaderboards from summary tables; the race screen, result and boards; the honest statement of
what anti-cheat can and cannot prove.

## Open decisions

- `[NEEDS DECISION: the accuracy-weighted score formula]` [Ticket 14][T14] fixes "accuracy-weighted,
  not raw speed", a 90% ranking floor and that finish order is also shown — not the formula, the tie
  break, or how boards aggregate a learner's races (best, mean, sum).
- `[NEEDS DECISION: behaviour at the throughput ceiling]` What a room or quick match does when the
  concurrent-race budget (about 10–20) is exhausted: queue, refuse with a message, or shed spectators'
  progress first. [Research 05][R5] also leaves open whether the limit counts sends or deliveries.
- `[NEEDS DECISION: where race texts come from]` [Ticket 14][T14] takes them from authored corpora
  (Academy paragraphs and authored texts), which F3 produces; the roadmap lists F5's dependency as F2
  only. Either F5 depends on F3's authored corpus or ships its own minimal authored set.
- `[NEEDS DECISION: what "difficulty" means for a race text]` Ticket 14 filters rooms by language and
  difficulty, but a Difficulty Tier grades *words* ([ticket 12][T12]).
- `[NEEDS DECISION: disconnects and timeouts]` Ticket 14 lists reconnect and late join but decides only
  the latter and the 30 s idle rule; [`CONTEXT.md`](../../CONTEXT.md) mentions a timeout without a value.
- `[NEEDS DECISION: error policy inside a race]` [Ticket 10][T10] names an error-free variant only as a
  later option; the default Backspace policy in a race is unstated. Accuracy counts every wrong key
  either way ([ADR-0004][A4]).
- `[NEEDS DECISION: does a race result also count as a training attempt?]` Nothing says whether a race
  feeds curriculum progress through `submit-attempt` or stays separate. This spec keeps it separate.
- `[NEEDS DECISION: group housekeeping]` Members per group, several groups per learner, leaving, and
  owner transfer are unspecified beyond "owner and member".

## User Scenarios & Testing *(mandatory)*

Five stories over one Foundational phase that holds the tables, RLS, contracts, scoring and replay
functions and the race interfaces. A story whose test needs another's output seeds it through an RPC
helper rather than importing its code.

### User Story 1 - Groups (Priority: P1)

A teacher or captain creates a group and gets a join code; members join with it. The group page lists
members with their nicknames and a practice board (minutes practised, stage progress) for the teacher.

**Independent Test**: two signed-in users; A creates a group, B joins with the code; both see the
member list; A's practice appears on the board; a third non-member cannot read the group.

**Acceptance Scenarios**:

1. **Given** a signed-in learner, **When** they create a group, **Then** they become its owner and
   receive a join code.
2. **Given** a code, **When** another learner enters it, **Then** they join as a member.
3. **Given** a group, **When** a non-member queries it directly, **Then** RLS denies it.
4. **Given** practice attempts by members, **When** the group page renders, **Then** minutes practised
   and stage progress appear as columns that are not part of any score.
5. **Given** a nickname belonging to another learner, **When** viewed outside a group or board,
   **Then** it is not readable.

---

### User Story 2 - A private room, to a synchronised start (Priority: P1)

A learner creates a room, shares its six-character code or invite link, others join, and the owner
starts. Everyone sees the same 3-2-1 against the **server's** timestamp, and nobody can forge the start.

**Independent Test**: two browser contexts; A creates, B joins by code and by link, A starts; both show
the same countdown from `starts_at` corrected by the server clock offset, and a client sending a fake
`state` message is ignored.

**Acceptance Scenarios**:

1. **Given** a room in `gathering`, **When** the owner starts, **Then** `starts_at = now() + 3 s` is set
   by the database and sent to the room by the database.
2. **Given** two clients with different local clocks, **When** the countdown runs, **Then** both reach
   zero at the same server instant using the offset from `join_*`.
3. **Given** a client, **When** it broadcasts a forged `state`, **Then** no other client acts on it.
4. **Given** a full room of five racers, **When** a sixth joins, **Then** they become a spectator.
5. **Given** a room the learner is not in, **When** they subscribe to its channel, **Then** RLS refuses.

---

### User Story 3 - Race to a validated result (Priority: P1)

Racers type the same text of about 300 characters in lanes, watching each other advance. On finishing
each submits the keystroke log; the server replays it, and only then is a result shown as validated,
ranked by accuracy-weighted score with the finish order also visible.

**Independent Test**: a room seeded in `running` via RPC; two contexts finish; both see "validating"
then a validated result; a tampered log is rejected with a typed reason; 88% accuracy is shown as below
the floor and unranked.

**Acceptance Scenarios**:

1. **Given** a running race, **When** a racer types, **Then** their client broadcasts progress about
   twice a second and other lanes move by forward-only interpolation.
2. **Given** a finished racer, **When** they submit the log, **Then** `finish-race` replays it against
   the race text and returns `{result, validated}`.
3. **Given** a log that cannot produce the text or has implausible intervals, **When** replayed,
   **Then** it is rejected with a typed reason and never reaches a board.
4. **Given** accuracy under 90%, **When** the result shows, **Then** it says so and is not ranked.
5. **Given** a manipulated live position, **When** the race ends, **Then** the ranked order comes only
   from replayed results and the screen states that live positions are display only.
6. **Given** motion is off, **When** the race runs, **Then** lanes still update without animation.

---

### User Story 4 - Leaderboards (Priority: P1)

Three boards — group, weekly, global — rank validated results only. The weekly board resets each Monday
at 00:00 Kyiv time. Smoke-test accounts never appear.

**Independent Test**: seed validated results for several users; each board lists them correctly, a
below-floor result and an `is_test` user are absent, and the weekly board empties after the reset job.

**Acceptance Scenarios**:

1. **Given** validated results, **When** a board renders, **Then** ranks follow the score and only
   results with at least 90% accuracy appear.
2. **Given** a rejected or below-floor result, **When** any board renders, **Then** it is absent.
3. **Given** the weekly reset moment, **When** it passes, **Then** the weekly board is empty and the
   global board is unchanged.
4. **Given** a profile flagged `is_test`, **When** boards render, **Then** it appears on none.
5. **Given** a board opened twice within 60 seconds, **When** rendered, **Then** the second read is
   served from the client cache.

---

### User Story 5 - Quick match and spectators (Priority: P2)

A learner picks a language and difficulty and is placed into an automatic room of up to five. Latecomers
watch live; a racer idle for 30 seconds becomes a spectator so the room is not held hostage.

**Independent Test**: six contexts call quick match for one filter; five race, one spectates; a racer
who types nothing for 30 s is moved to spectators and the race proceeds.

**Acceptance Scenarios**:

1. **Given** a language and difficulty, **When** quick match is pressed, **Then** the learner joins an
   open room of that filter or a new one, under a row lock so two callers never overfill it.
2. **Given** a room already running, **When** another learner joins, **Then** they are a spectator who
   sees lanes live and sends no progress.
3. **Given** a racer idle for 30 seconds, **When** the time passes, **Then** they become a spectator.
4. **Given** the concurrent-race budget is exhausted, **When** quick match is pressed, **Then** the
   outcome is the one decided in Open decisions.

---

### Edge Cases

- A racer finishes before the start timestamp locally because of clock skew: their log is judged
  against server time, not theirs.
- A log arrives after the room moved to `finished`: it is still replayed for that racer's own result.
- Two quick-match callers race for the last seat: one wins the lock, the other goes to the next room.
- A room owner leaves before starting: ownership falls to the earliest remaining member.
- The race text row is missing: the room cannot start and says why.

## Requirements *(mandatory)*

### Functional Requirements

**Budget and transport**

- **FR-001**: The design MUST stay inside Realtime throughput — about 100 messages a second — giving
  roughly 10–20 concurrent five-racer races; connections are not the binding limit. [T05][R5][A6]
- **FR-002**: A room MUST hold at most five racers, each sending progress at most twice a second. [A6]
- **FR-003**: Progress MUST be Broadcast `{u, i, e, t}` for display only; other lanes MUST move by
  forward-only linear interpolation. [T21][T20]
- **FR-004**: Whether the limit counts sends or deliveries MUST be measured before the demo, and the
  progress rate MUST be a single constant so it can be lowered. [R5]
- **FR-005**: Each room MUST use a private channel `race:{roomId}` authorised by RLS on
  `realtime.messages`; Presence carries the roster. [T21]
- **FR-006**: `state {state, startsAt}` MUST be sent by the database through `realtime.send()` inside
  `start_race` and `finish-race`, so clients cannot forge a start. [T21]
- **FR-007**: The client clock offset MUST come from the server `now()` returned by the `join_*` RPCs.
  [T21]

**Rooms**

- **FR-008**: `race_rooms` MUST carry the state machine `gathering → countdown → running → finished` on
  server time. [T21]
- **FR-009**: `start_race` MUST set `starts_at = now() + 3 s`, and every client MUST show the 3-2-1
  against it. [T21][T14]
- **FR-010**: Private rooms MUST be joinable by a six-character code or an invite link
  (`join_by_code`). [T14][T21]
- **FR-011**: Quick match (`join_quick_match(lang, difficulty)`) MUST fill rooms of up to five under a
  row lock. [T14][T21]
- **FR-012**: Latecomers MUST join as spectators and a racer idle for 30 seconds MUST become one. [T14]
- **FR-013**: Room operations MUST be `security definer` RPCs; `race_rooms`, `race_participants` and
  `race_results` MUST be visible to the room's participants and written only by RPC and `finish-race`.
  [T21]

**Texts and validation**

- **FR-014**: Every racer MUST get the same text of about 300 characters, from our own licensed or
  authored corpora only, filtered by language and difficulty; `race_texts` MUST be public-read and seeded
  at deploy from `data/curriculum/` with a `content_hash` check. [T14][T21][A6]
- **FR-015**: A race text MUST be shown as a static three-line block with one lane per racer. [T20]
- **FR-016**: `finish-race {roomId, attemptId, log}` MUST replay the log against the race text, apply
  the plausibility checks, and return `{result, validated, reason?}`, importing `metrics` and
  `curriculum` unchanged. [A6][A7][T21][T09]
- **FR-017**: Only a Validated Result MAY reach a leaderboard. [CONTEXT]
- **FR-018**: The winner MUST be decided by an accuracy-weighted score, not raw speed; finish order MUST
  also be shown; a result needs at least 90% accuracy to be ranked, and a below-floor result MUST be shown
  as such. [T14][T20]
- **FR-019**: Live positions MAY be wrong or manipulated; the ranked result MUST NOT be. The app and the
  README MUST say so honestly, including what anti-cheat can and cannot prove. [A6]
- **FR-020**: Rejections MUST carry typed reasons (`text_mismatch`, `implausible_interval`, …). [T21]

**Groups and boards**

- **FR-021**: A teacher or captain MUST be able to create a group with a join code; roles are owner and
  member; `groups` and `group_members` are visible to members and changed via RPC. [T14][T21]
- **FR-022**: Three boards — group, weekly, global — MUST be computed from summary tables `lb_weekly`,
  `lb_global` and `group_practice`, maintained by triggers on validated results. [T14][T21]
- **FR-023**: The group board MAY show practice columns (minutes practised, stage progress); they MUST
  NOT be part of the score. [T21]
- **FR-024**: The weekly board MUST reset on Monday at 00:00 Kyiv time via `pg_cron` declared in a
  migration. [T21]
- **FR-025**: Board reads MUST be cached 60 seconds in TanStack Query. [T11]
- **FR-026**: Profiles flagged `is_test` MUST be excluded from every board. [T15]
- **FR-027**: Another learner's nickname MUST be visible only through boards and groups. [T21]
- **FR-028**: No board may be called a "global rating" unless it is genuinely server-backed. [CONTEXT]

**Client, visuals and tests**

- **FR-029**: A `sync.race(roomId)` event-emitting race object MUST exist with a Supabase and an
  in-memory adapter, so UI tests run without Docker. [T21]
- **FR-030**: The race lifecycle MUST be a hand-written typed reducer, property-tested. [T11][T15]
- **FR-031**: The room MUST be one screen with five states — gathering, 3-2-1, racing, validating,
  result — and *validating* MUST show per-player rows. [T20]
- **FR-032**: Race motion MUST obey the app-level flag: off means no animation and no sound. [T20]
- **FR-033**: A five-racer race MUST be tested as five browser contexts in one test, and RLS, RPCs and
  functions against local Supabase acting as several users, allowed and denied. [T15]
- **FR-034**: Every race, group and board screen MUST require sign-in. [A2]

## Success Criteria *(mandatory)*

- **SC-001**: Two clients with different clocks show the same countdown zero to within one frame.
- **SC-002**: No client-sent message can change a room's state or a ranked result.
- **SC-003**: A tampered or implausible log never appears on any board, in 100% of cases.
- **SC-004**: A five-racer race at the progress rate sends no more than ten broadcasts a second per room.
- **SC-005**: Replaying the same log against the same text always returns the same verdict and score.
- **SC-006**: `is_test` accounts and below-floor results appear on no board.
- **SC-007**: The weekly board is empty after Monday 00:00 Kyiv time; the global board is unchanged.
- **SC-008**: Every F5 screen reports zero accessibility violations and is keyboard operable.

## Definition of Done *(restated from the constitution — test tasks are emitted only when asked)*

Constitution principle II applies to every story: domain logic test-first with property tests; an
end-to-end test per user-visible acceptance scenario on the production build; zero axe violations.
Working gates per [ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md): `pnpm typecheck`,
`pnpm lint`, `pnpm test`; Playwright on Chromium during work, in full at the end.

## Out of scope

Ghosts, pace caret, error-free race variant, level-band ranks ([T09]) · image-verification challenge ·
custom-text races · our own WebSocket server · replay anti-cheat for training attempts · social sharing ·
any feature needing more than the Free-tier Realtime budget.

## Dependencies

F2 (accounts, `submit-attempt`, the contracts package, `sync`). Race texts: see Open decisions.
External: a Supabase Free project with Realtime and `pg_cron`; local Supabase for tests.

[A2]: ../../docs/adr/0002-mandatory-authentication.md
[A4]: ../../docs/adr/0004-accuracy-first-metrics-and-gating.md
[A6]: ../../docs/adr/0006-race-authority-broadcast-for-display-edge-function-for-truth.md
[A7]: ../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md
[CONTEXT]: ../../CONTEXT.md
[R5]: ../../docs/research/05-supabase-vercel.md
[T05]: ../../.scratch/typing-race-hackathon/issues/05-supabase-vercel-free-tier-research.md
[T09]: ../../.scratch/typing-race-hackathon/issues/09-requirements-beyond-tz.md
[T10]: ../../.scratch/typing-race-hackathon/issues/10-pedagogical-model.md
[T11]: ../../.scratch/typing-race-hackathon/issues/11-stack-and-architecture.md
[T12]: ../../.scratch/typing-race-hackathon/issues/12-dictionary-pipeline-and-exercise-generation.md
[T14]: ../../.scratch/typing-race-hackathon/issues/14-races-and-group-leaderboards.md
[T15]: ../../.scratch/typing-race-hackathon/issues/15-testing-strategy-and-cicd.md
[T20]: ../../.scratch/typing-race-hackathon/issues/20-key-screen-mockups-and-motion-spec.md
[T21]: ../../.scratch/typing-race-hackathon/issues/21-system-design-and-data-model.md
