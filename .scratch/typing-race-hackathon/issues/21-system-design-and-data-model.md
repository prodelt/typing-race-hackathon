# 21 Grilling: System design, data model & contracts

Type: grilling
Status: resolved
Blocked by: none

## Question

Now that accounts (13), races (14) and the dictionary pipeline (12) are decided, what is the system's shape?

Decide:
- component and deployment diagram: SPA, service worker, Supabase Auth/DB/Realtime, Edge Functions (attempt ingest + derived progress, race validation, profile deletion), scheduled log pruning, build-time pipeline;
- the PostgreSQL data model: profiles, attempts (append-only, seed + keystroke log), derived progress and per-key/per-transition confidence, groups, race rooms and results, leaderboard summary tables; RLS per table;
- contracts: Edge Function request/response shapes, Realtime Broadcast message schemas and rates, the client data-chunk format produced from `data/derived/`;
- the IndexedDB cache and outbox shape;
- where these land: `plan.md` / `data-model.md` / `contracts/` under Spec Kit, or ADRs first.

Inputs: tickets 05, 11, 12, 13, 14; ADR-0002…0005.

## Answer

## Decisions — grilling round 1 (2026-09-18)

- **Replay scope:** only race finishes are replayed server-side (ADR-0006). Training attempts get the ticket-09 plausibility checks only. The map's Out-of-scope line is narrowed to "replay anti-cheat for training attempts".
- **Attempt ingest:** an Edge Function `submit-attempt` (Deno) imports the same TS `metrics` and `curriculum` packages as the client, runs plausibility checks, **recomputes metrics from the log** (never trusts client numbers) and writes the attempt plus derived progress in one transaction. RLS denies clients a direct insert into `attempts`.
- **Progress derivation:** a full fold `deriveProgress(aggregates[])` over the learner's attempts ordered by `completed_at`, re-run on every insert, so out-of-order outbox arrivals from several devices are correct. Every attempt keeps its **aggregates forever** (per key and per transition: count, misses, sum and sum of squares of timing). The same function runs on the client offline.
- **Keystroke log storage:** a separate table `keystroke_logs(attempt_id PK, format_version, payload)` with a compact parallel-array payload (time deltas in ms, event codes, characters; ~1.5 KB per 150-char exercise). Pruning deletes only these rows; `format_version` keeps old logs replayable.
- **Race room operations** are Postgres RPCs (`security definer`): `join_quick_match(lang, difficulty)` with a row lock, `join_by_code`, `start_race` (sets `starts_at = now() + 3 s`). `race_rooms` carries the state machine `gathering → countdown → running → finished` with server time. The only race Edge Function is `finish-race` (replay).
- **Leaderboards:** the score on every board comes only from validated races. The group board additionally shows practice columns (minutes practised, stage progress) for the teacher; these are not part of the score.
- **Client backend seam:** a deep `sync` module — `submitAttempt(attempt)` (IndexedDB + outbox, then the Edge Function when online), `progress()` (cache first, refreshed from the server), `race(roomId)` (an event-emitting race object). Two adapters: Supabase and in-memory (unit tests and UI E2E without Docker); the Supabase adapter is tested against local Supabase. No `supabase.from(...)` outside `sync`.

## Decisions — grilling round 2 (2026-09-18)

- **Tables and RLS:**
  - `profiles` — own row only;
  - `attempts` and `keystroke_logs` — read own, written only by the Edge Function; `attempts.id` is a **client-generated UUID**, so outbox retries are idempotent (`on conflict do nothing`);
  - `progress` — one jsonb snapshot per learner × language with `derived_version`, written only by the function;
  - `groups`, `group_members` — visible to members, changed via RPC;
  - `race_texts` — public read, seeded at deploy;
  - `race_rooms`, `race_participants`, `race_results` — visible to the room's participants, written by RPC and `finish-race`;
  - summary tables `lb_weekly`, `lb_global`, `group_practice` — maintained by triggers.

  Other people's nicknames are visible only through leaderboards and groups.
- **Realtime per room:** private channel `race:{roomId}` authorised by RLS on `realtime.messages`. Presence carries the roster; Broadcast `progress {u, i, e, t}` twice a second is display only; Broadcast `state {state, startsAt}` is sent **by the database** via `realtime.send()` inside `start_race` and `finish-race`, so clients cannot forge a start. The clock offset comes from the server `now()` returned by the `join_*` RPCs.
- **Edge Function contracts** (Zod schemas shared by client and functions):
  - `submit-attempt {attempts: [...]} → {accepted, rejected: [{id, reason}], progress}` — batched, because the outbox flushes everything at once;
  - `finish-race {roomId, attemptId, log} → {result, validated, reason?}`;
  - `delete-account → 204`.

  Rejections carry typed reasons (`implausible_interval`, `too_fast`, `text_mismatch`, …) so the UI can explain them.
- **IndexedDB:** `outbox`, `progress` and `recent-attempts` (the last 20), all keyed by user id; exercise data is cached by the service worker. **Sign-out clears the cache**, after a warning if the outbox still holds unsent attempts. This protects learners on shared machines, and §8.9 is unaffected because a reload is not a sign-out.
- **Deployment:**
  - `supabase/` in the repo holds migrations, functions and seed;
  - CI runs migrations and tests against local Supabase in Docker;
  - merging to `main` runs `supabase db push` and the function deploy via a GitHub Action;
  - `race_texts` is seeded from `data/curriculum/` with a `content_hash` check;
  - `pg_cron` resets the weekly board on Monday at 00:00 Kyiv time and prunes logs nightly, both declared in migrations;
  - a scheduled GitHub Action pings the project every 3 days so the Free tier never pauses before a demo.
- **Artifacts:** decisions live here; `speckit-plan` turns them into `data-model.md` and `contracts/`. [ADR-0007](../../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md) records the server-side recompute with shared packages.

## Round 3 and resolution (2026-09-18)

- **Client data chunks:** **delta chunks** — chunk *k* holds only words with `unlockIndex = k`; the client loads chunks 0…n and merges them, with no duplication. The service worker caches the unlocked chunks plus the next one. n-gram tables, morphemes, scales and Academy modules are one file per language and kind. All are emitted by a small Vite plugin from `data/derived/` and `data/curriculum/` with hashed names and immutable caching. Every file carries `dataVersion`, stored on the attempt next to the exercise `content_hash`, so replay knows which data built the exercise.

Resolved 2026-09-18. Glossary: Attempt Aggregates, Validated Race Result added to `CONTEXT.md`. ADR-0007 added.
