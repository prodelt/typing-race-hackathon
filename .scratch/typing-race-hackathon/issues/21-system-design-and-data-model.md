# 21 Grilling: System design, data model & contracts

Type: grilling
Status: open
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
