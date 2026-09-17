---
status: accepted
---

# Append-only attempts as the single source of truth

An attempt is an immutable row plus its keystroke event log. Curriculum progress, unlocked keys and per-key/per-transition confidence are derived values, recomputed server-side when an attempt is inserted, never edited in place. Decided 2026-09-17.

## Consequences

- Cross-device conflicts cannot occur: every device only appends. There is no last-write-wins rule to get wrong.
- The same log already underpins metrics (ADR-0004) and race validation (ADR-0006), so the system has one data model instead of three.
- Storage is bounded deliberately: the full keystroke log is kept for a user's last 20 attempts and pruned after 30 days, while aggregates are kept forever. The Supabase Free database is 500 MB and raw logs dwarf aggregates.
- The client caches progress in IndexedDB keyed by user and queues unsent attempts in an outbox, which is what makes TZ §4.1 and automated check §8.9 pass under mandatory sign-in and offline.
