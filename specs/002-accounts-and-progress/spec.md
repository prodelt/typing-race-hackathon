# Feature Specification: Accounts and Progress

**Feature ID**: F2 · **Feature Directory**: `specs/002-accounts-and-progress`

**Status**: Compact package (ADR-0010) — spec and tasks only, no separate plan

**Input**: F2 `002-accounts-and-progress` from [`specs/roadmap.md`](../roadmap.md). Every requirement
below is sourced from a ticket or ADR and cites it; nothing is newly decided here. A gap is written as
`[NEEDS DECISION: …]`. Product rules in `AGENTS.md` § Non-negotiable product rules are inherited, not
restated.

## Summary

F1 proved typing with a browser-only store. F2 makes the product a real one: every learner signs in,
every attempt is judged by the server with the **same** `metrics` and `curriculum` packages the client
uses, progress is derived on the server and cached locally, and the learner owns their data (history,
export, deletion). It adds no leaderboards (F5) and no new drill types.

**F2 removes F1's authentication waiver.** Principle VII was waived for F1 alone
(`specs/001-typing-core/plan.md` § Waiver, `Waived: VII — authentication arrives in F2`) on the
stated ground that F1 was preview-only. F2 is what makes the waiver unnecessary: every learning screen
sits behind sign-in and progress is derived server-side. From F2 on, no change carries a VII waiver,
and the product may be deployed to a public production URL.

## Scope Boundary

**In F2.** Email + password and Google/GitHub sign-in (PKCE); a mandatory nickname; route guarding; the
database (profiles, attempts, keystroke logs, progress) with RLS; the `submit-attempt` and
`delete-account` Edge Functions; a Supabase adapter for F1's `ProgressStore` and the `sync` module; the
IndexedDB cache and outbox; the history page; the real privacy page; export/import; account deletion;
the backend CI/deploy workflows and the keep-alive.

## Groundwork already in the tree (untracked at the time of writing)

`supabase/config.toml`, `supabase/migrations/20260930120000_core.sql` (profiles, attempts,
keystroke logs, progress, RLS, `prune_keystroke_logs`), `supabase/functions/submit-attempt/index.ts`,
`supabase/functions/_shared/cors.ts` and `supabase/functions/deno.json` (workspace packages mapped with
`sloppy-imports`) already exist. Tasks treat them as a **first draft to review against the
requirements**, not as done: the function is not yet one transaction (FR-016), is not Zod-validated
(FR-019), derives progress for the first submission's language only, and its plausibility numbers
(12 ms interval, 1200 SPM) differ from the window [ticket 09][T09] names (40 ms–12 s).

## Open decisions

- `[NEEDS DECISION: how the Supabase adapter satisfies clear()]` The contract suite asserts `clear()`
  returns the store to `'empty'`, but attempts are append-only ([ADR-0005][A5]). Candidates: `clear()`
  empties only the local cache and the suite binds a fresh user per test; or it wipes an `is_test` user.
- `[NEEDS DECISION: how the suite's fixtures meet server recomputation]` Its fixtures carry hand-written
  metrics and a log inconsistent with its text; `submit-attempt` recomputes ([ADR-0007][A7]) and
  plausibility-checks. "Unchanged" holds only if the function accepts them or runs in a mode they satisfy.
- `[NEEDS DECISION: numeric plausibility limits]` [Ticket 09][T09] fixes the 40 ms–12 s interval window,
  not the minimum duration, CPM cap, rate limit or AFK threshold N. The draft uses 12 ms and 1200 SPM.
- `[NEEDS DECISION: log retention reading]` [ADR-0005][A5]: "last 20 attempts … pruned after 30 days".
  Read here as: newest 20 only, and none older than 30 days.
- `[NEEDS DECISION: where the shared Zod schemas live]` `@typing-race/domain` is types-only (ADR-0010);
  tasks assume a new pure `packages/contracts/`.
- `[NEEDS DECISION: import of an F1 local store]` F1 left it to F2; F1 was preview-only, so this spec
  defaults to no import. `[NEEDS DECISION: can an import carry attempts without a log?]` Aggregates-only
  history cannot be recomputed ([ADR-0007][A7]).
- `[NEEDS DECISION: sync versus ProgressStore]` [Ticket 21][T21] names a `sync` module; F1 shipped
  `ProgressStore`. Read here as `sync` composing the adapter plus the outbox, with `race()` added by F5.
- `[NEEDS DECISION: OAuth email equal to an existing password account]` Link or refuse? No ticket says.

## User Scenarios & Testing *(mandatory)*

Five stories over one Foundational phase. Foundational carries the migrations, the shared contracts and
every hot file; stories then own disjoint trees.

### User Story 1 - Sign up, sign in, choose a nickname (Priority: P1)

A new learner creates a profile with email and password, or with Google or GitHub, and is inside the
app at once. Before anything else they choose a nickname, which is the only name other people will see.
Anyone not signed in can read only the public pages.

**Independent Test**: in a fresh browser create a profile with email and password, set a nickname and
reach Today; sign out; open `/path` and get redirected to sign-in while `/formulas` still renders.

**Acceptance Scenarios**:

1. **Given** a visitor on the sign-up form, **When** they submit a valid email and password,
   **Then** the account exists and they are signed in without confirming email.
2. **Given** a visitor, **When** they choose Google or GitHub, **Then** they return signed in via the
   PKCE flow and reach the nickname step.
3. **Given** a signed-in learner with no nickname, **When** they try any learning route,
   **Then** they are held at the nickname step until one is set.
4. **Given** a signed-out visitor, **When** they open any learning route,
   **Then** they reach sign-in, and the product page, Formulas, licences, privacy and about stay open.
5. **Given** a learner who forgot their password, **When** they request a reset, **Then** a reset mail
   is sent and the new password works. Mail delay never affects ordinary sign-in.
6. **Given** a signed-in learner, **When** they sign out, **Then** they return to the product page and
   the local cache holds nothing of theirs (User Story 3 covers the unsent-attempts warning).
7. **Given** two learners on one browser in turn, **When** the second signs in, **Then** nothing of the
   first's progress is visible.

---

### User Story 2 - The server judges every attempt (Priority: P1)

A finished attempt is sent to the `submit-attempt` function as a batch. The function validates it,
recomputes every metric and aggregate from the keystroke log with the shared packages, stores it once,
and returns the learner's freshly derived progress — or a typed reason it refused.

**Independent Test**: an integration test against local Supabase, acting as two users, submits valid,
tampered, implausible, duplicate and out-of-order batches; it asserts what is stored, what progress
returns, what is refused with which reason, and that a direct insert into `attempts` is denied.

**Acceptance Scenarios**:

1. **Given** a valid attempt whose claimed metrics are wrong, **When** it is submitted, **Then** the
   stored metrics equal the recomputation from the log and the client's numbers are discarded.
2. **Given** an attempt with an interval outside the plausibility window or an implausible speed,
   **When** it is submitted, **Then** it is listed in `rejected` with a typed reason and nothing is
   stored for it.
3. **Given** a batch containing an attempt id already stored, **When** it is submitted,
   **Then** there is still one row and `accepted` still names it.
4. **Given** attempts arriving out of completion order, **When** the last one lands, **Then** progress
   equals the fold over all attempts ordered by `completed_at`.
5. **Given** a test attempt that completes the Mastery Rule, **When** accepted, **Then** the returned
   progress carries the newly unlocked key.
6. **Given** a client authenticated as learner A, **When** it inserts into `attempts` directly or reads
   learner B's rows, **Then** RLS denies both.
7. **Given** a twenty-first attempt, **When** accepted, **Then** the oldest keystroke log is gone and
   its aggregates, its place in history and every derived number are unchanged.

---

### User Story 3 - Progress follows the learner (Priority: P1)

The app renders from the local cache after a reload without waiting for the network, practice keeps
working offline, and attempts made offline reach the server when the network returns. A second device
shows the same progress.

**Independent Test**: sign in, finish an attempt, go offline, finish another, reload and see progress
rendered from cache; go online and watch the outbox drain; a second browser context signed in as the
same learner shows the same unlocked set; sign-out with a non-empty outbox warns first.

**Acceptance Scenarios**:

1. **Given** a signed-in learner, **When** they reload, **Then** Today renders from the cache before
   any server response, with a sync badge showing state.
2. **Given** no network, **When** the learner completes an unlocked exercise, **Then** the result
   appears and the attempt waits in the outbox.
3. **Given** a non-empty outbox, **When** the network returns, **Then** it drains to `submit-attempt`,
   a retried batch never double-counts, and the badge reports synced.
4. **Given** two devices for one learner, **When** each completes attempts offline and both sync,
   **Then** both converge on one progress with no conflict to resolve.
5. **Given** a non-empty outbox, **When** the learner signs out, **Then** they are warned first and
   sign-out clears the cache only after they confirm.
6. **Given** the server rejects an outbox attempt, **When** the reason arrives, **Then** the learner is
   told which attempt and why, and the rejected item leaves the outbox.
7. **Given** F1's `ProgressStore` contract suite, **When** run against the Supabase adapter, **Then**
   its assertions pass unchanged (subject to the two open decisions on `clear()` and fixtures).

---

### User Story 4 - History of everything I did (Priority: P2)

The learner sees every attempt they have made, a per-day chart, and their personal best per exercise,
even for attempts whose keystroke log was pruned.

**Independent Test**: seed 25 attempts over several days, open History, and read the list, the daily
chart and the personal bests; the five oldest show their metrics and say plainly the raw log is gone.

**Acceptance Scenarios**:

1. **Given** attempts on several days, **When** History opens, **Then** a per-day chart and a list
   ordered by completion render from aggregates alone.
2. **Given** an attempt whose log was pruned, **When** it is opened, **Then** its metrics show and the
   parts needing the raw log say the detail is no longer kept.
3. **Given** repeated attempts on one exercise, **When** History renders, **Then** the personal best is
   named, ordered by accuracy first.
4. **Given** the daily chart, **When** read without colour or a pointer, **Then** a text alternative
   states each day's attempt count and mean accuracy.

---

### User Story 5 - My data is mine (Priority: P2)

The privacy page states in plain language what is stored; the learner can export their data, import a
file, and delete their account themselves.

**Independent Test**: open Privacy signed out and read it; signed in, export, delete the account, and
confirm the learner can no longer sign in and every owned row is gone.

**Acceptance Scenarios**:

1. **Given** the privacy page, **When** read, **Then** it lists what is collected — email, nickname,
   layout and language, attempts with metrics, group membership — that inter-keystroke intervals are
   stored, and that no third-party analytics load.
2. **Given** a signed-in learner, **When** they export, **Then** they receive a file of their attempts
   and progress in a documented, versioned format.
3. **Given** an export file, **When** imported, **Then** accepted attempts pass the same validation as
   a live submission and refused ones are listed with reasons.
4. **Given** the delete action, **When** confirmed, **Then** `delete-account` returns 204 and the
   profile, attempts, logs and progress are gone with the Auth user.
5. **Given** a signed-in client, **When** it tries to delete an Auth user directly, **Then** it cannot.

---

### Edge Cases

- Sign-up from a shared venue IP: per-IP limits are raised so a room of jurors is not blocked
  ([ticket 13][T13], [research 05](../../docs/research/05-supabase-vercel.md)).
- Access token expires while offline: practice continues from cache; submission waits for a refresh.
- Two tabs of one learner drain the outbox at once: idempotent ids make the second a no-op.
- A batch larger than a function limit: the client splits it; the function answers per attempt.
- The `derived_version` of a stored snapshot is older than the code's: progress is re-derived, never
  served stale.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts**

- **FR-001**: The system MUST offer email and password sign-up with email confirmation disabled, so a
  profile exists and is usable immediately. [T13]
- **FR-002**: The system MUST offer Google and GitHub sign-in using the PKCE flow. [T13]
- **FR-003**: Mail (Resend as custom SMTP) MUST serve only password resets and system mail and MUST
  never sit on the daily sign-in path. [T13]
- **FR-004**: A nickname MUST be mandatory at first sign-in; it is what leaderboards show; there are no
  avatars, only initials. [T13]
- **FR-005**: Every screen a learner can reach MUST require sign-in except the product page, Formulas,
  licences, privacy, about and the sign-in/up/reset screens. [A2][T17]
- **FR-006**: F1's waiver of principle VII MUST be retired: the waiver is marked lapsed in
  `specs/001-typing-core/plan.md` and no later change carries a VII waiver. [Roadmap]
- **FR-007**: `profiles` MUST be readable and writable by its owner only, and MUST carry an `is_test`
  flag so preview-smoke accounts can be kept off boards. [T21][T15]
- **FR-008**: Sign-out MUST warn when the outbox holds unsent attempts and MUST clear the local cache
  afterwards, so a shared machine keeps nothing. [T21]

**The server**

- **FR-009**: Clients MUST NOT insert attempts directly; RLS MUST deny it. `attempts` and
  `keystroke_logs` are readable by their owner and written only by `submit-attempt`. [T21]
- **FR-010**: `submit-attempt` MUST accept `{attempts: […]}` and return
  `{accepted, rejected: [{id, reason}], progress}`, batched because the outbox flushes at once. [T21]
- **FR-011**: The function MUST import `packages/metrics` and `packages/curriculum` **unchanged**,
  recompute every metric and aggregate from the log, and never trust client numbers. [A7]
- **FR-012**: Both packages MUST stay free of browser and Node APIs; a CI check MUST run them under
  Deno so this cannot regress. [A7]
- **FR-013**: The function MUST run plausibility checks — minimum duration, a 40 ms–12 s interval
  window, a CPM cap, rate limiting — and flag AFK pauses over N seconds, excluding them from speed.
  [T09] (limits: see Open decisions)
- **FR-014**: Rejections MUST carry typed reasons (`implausible_interval`, `too_fast`, …). [T21]
- **FR-015**: `attempts.id` MUST be a client-generated UUID and inserts MUST be `on conflict do
  nothing`, so retries are idempotent. [T21][A7]
- **FR-016**: Attempt, aggregates, log and re-derived progress MUST be written in one transaction. [A7]
- **FR-017**: Progress MUST be a full fold `deriveProgress` over the learner's attempts ordered by
  `completed_at`, re-run on every insert, stored as one jsonb row per learner × language with
  `derived_version`. [T21][A5]
- **FR-018**: Attempt aggregates MUST be kept forever; the full log only for the 20 most recent
  attempts (applied on insert) and never beyond 30 days (nightly `pg_cron`). Pruning MUST change no
  metric, confidence value or unlocked key. [A5][T13][F1 FR-081]
- **FR-019**: Request and response shapes MUST be Zod schemas shared by client and functions. [T21]
- **FR-020**: `delete-account` MUST return 204 and cascade through every owned row, because a client
  cannot delete an Auth user. [T13]

**The client**

- **FR-021**: A Supabase adapter for F1's `ProgressStore` MUST exist and MUST pass
  `apps/web/src/seams/store.contract.test.ts` **unchanged** — assertions untouched, the adapter only
  registered in its adapter list. This is the suite F1 wrote for F2.
- **FR-022**: A `sync` module MUST expose `submitAttempt(attempt)` (IndexedDB + outbox, then the
  function when online) and `progress()` (cache first, refreshed from the server), with a Supabase and
  an in-memory adapter and one contract suite over both. No `supabase.from(...)` may appear outside
  `sync`. [T21][T15]
- **FR-023**: IndexedDB MUST hold `outbox`, `progress` and `recent-attempts` (the last 20), all keyed by
  user id; exercise data stays in the service worker cache. [T21]
- **FR-024**: After a reload the page MUST render from cache without waiting for the server, and a sync
  badge MUST show the state. [A2][T17]
- **FR-025**: The outbox MUST drain on reconnect and MUST be safe to retry. [T13]
- **FR-026**: The settings and starting-level choice SHOULD follow the account across devices, because
  F1's seam already calls the choice "progress rather than a preference". [seams]

**History, data and privacy**

- **FR-027**: A History page MUST list every attempt from aggregates, with a per-day chart and personal
  bests, and MUST work when logs are pruned. [T09]
- **FR-028**: The privacy page MUST state what is collected, what is not, and that inter-keystroke
  intervals are stored. No third-party analytics or trackers may load. [T13]
- **FR-029**: The learner MUST be able to export their data in a documented, versioned format and to
  import it; an import MUST pass the same validation as a submission. [Roadmap][A7]
- **FR-030**: Account deletion MUST be self-service. [T13][A2]

**Operations**

- **FR-031**: `supabase/` MUST hold migrations, functions and seed; CI MUST run migrations and tests
  against local Supabase in Docker. [T21]
- **FR-032**: Merging to `main` MUST run `supabase db push` and the function deploy; a scheduled job
  MUST ping the project every 3 days. [T21][T15]
- **FR-033**: RLS, RPCs and functions MUST be tested against local Supabase acting as several users,
  asserting both allowed and denied access. [T15]
- **FR-034**: `.env.example` MUST list only the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`;
  every secret stays in Vercel, GitHub or `supabase secrets`. [T15]

## Success Criteria *(mandatory)*

- **SC-001**: A new learner goes from the product page to Today, with a nickname, in under a minute.
- **SC-002**: A stored attempt's metrics equal `computeMetrics` of its log in 100% of cases.
- **SC-003**: No client can write or read another learner's attempts, verified by denied-access tests.
- **SC-004**: Submitting one attempt twice leaves one attempt and the same progress.
- **SC-005**: Attempts from two devices in any arrival order fold to identical progress.
- **SC-006**: With the network off after sign-in, a learner completes an unlocked exercise and, on
  reconnect, the server holds it.
- **SC-007**: The Supabase adapter passes the F1 contract suite with no assertion changed.
- **SC-008**: `metrics` and `curriculum` pass a Deno check on every CI run.
- **SC-009**: Pruning logs changes zero reported values.
- **SC-010**: After deletion, zero rows remain for that learner in any table.
- **SC-011**: Every F2 screen reports zero accessibility violations and is keyboard operable.

## Definition of Done *(restated from the constitution — test tasks are emitted only when asked)*

Constitution principle II applies to every story: domain logic test-first with property tests; an
end-to-end test per user-visible acceptance scenario on the production build; zero axe violations.
Working gates per [ADR-0010](../../docs/adr/0010-twenty-four-hour-challenge-mode.md): `pnpm typecheck`,
`pnpm lint`, `pnpm test`; Playwright on Chromium during work, in full at the end.

## Out of scope

Groups, races, leaderboards (F5) · Word Bank, Stage 2 (F3) · Academy, heatmaps, Diagnostic (F4) ·
replay anti-cheat for training attempts · magic link and anonymous sign-in (rejected in [T13]) ·
social sharing ([T09]) · outage-hardening · avatars · migrating the F1 local store (see Open
decisions).

## Dependencies

F1 (`ProgressStore`, `Attempt`, `deriveProgress`, `computeMetrics`, the shell). External: a Supabase
Free project and local Supabase in Docker; Resend and OAuth credentials supplied as secrets.

[T09]: ../../.scratch/typing-race-hackathon/issues/09-requirements-beyond-tz.md
[T13]: ../../.scratch/typing-race-hackathon/issues/13-accounts-sync-privacy.md
[T15]: ../../.scratch/typing-race-hackathon/issues/15-testing-strategy-and-cicd.md
[T17]: ../../.scratch/typing-race-hackathon/issues/17-screen-map-and-user-journeys.md
[T21]: ../../.scratch/typing-race-hackathon/issues/21-system-design-and-data-model.md
[A2]: ../../docs/adr/0002-mandatory-authentication.md
[A5]: ../../docs/adr/0005-append-only-attempts-as-source-of-truth.md
[A7]: ../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md
[Roadmap]: ../roadmap.md
[seams]: ../../apps/web/src/seams/index.ts
[F1 FR-081]: ../001-typing-core/spec.md
