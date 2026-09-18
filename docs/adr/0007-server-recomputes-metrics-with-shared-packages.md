---
status: accepted
---

# The server recomputes metrics from the log with the client's own packages

Clients never write attempts directly. Every attempt goes through a Supabase Edge Function, `submit-attempt`, which imports the same TypeScript `metrics` and `curriculum` packages the client uses. It runs plausibility checks, recomputes every metric and aggregate from the submitted keystroke log instead of trusting client numbers, and in one transaction writes the attempt and re-derives the learner's progress. Decided 2026-09-18.

## Considered options

A direct client insert through PostgREST with RLS, plus a plpgsql trigger that derives progress. It needs no function invocations and has no cold start. Rejected because SPM, accuracy, confidence and unlock rules would then exist twice, in TypeScript and in plpgsql, and the TZ §8.1–8.2 checks would prove only one of them.

## Consequences

- There is one implementation of every formula. The Formulas page, the client's offline progress and the server's authoritative progress cannot disagree.
- Progress is a full fold `deriveProgress(aggregates[])` over the learner's attempts ordered by `completed_at`. It is re-run on every insert, so out-of-order outbox arrivals from several devices stay correct. Attempt aggregates are therefore kept forever, even after keystroke logs are pruned (ADR-0005).
- The `metrics` and `curriculum` packages must stay free of browser and Node APIs so they run under Deno. A CI check enforces this.
- Attempt ids are client-generated UUIDs, so outbox retries are idempotent.
- Every submitted attempt costs one function invocation, or one per batch, which is well within the Free tier's 500k per month.
