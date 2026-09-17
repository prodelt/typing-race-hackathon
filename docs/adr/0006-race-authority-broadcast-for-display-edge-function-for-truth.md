---
status: accepted
---

# Race authority: Broadcast for display, an Edge Function for truth

Supabase Realtime Broadcast is a relay with no server-side logic, so it cannot arbitrate a race. During a race each client broadcasts its own progress twice a second for display only; the start is anchored to a server timestamp; and the finish is validated by a Supabase Edge Function that replays the submitted keystroke log against the known race text, applies plausibility checks, and only then lets the result reach a leaderboard. Decided 2026-09-17.

## Considered options

Trusting client-reported results with plausibility checks alone (cheap, but TZ §11 disqualifies a leaderboard that is not honestly server-backed) and running our own authoritative WebSocket server (real authority, but new infrastructure and cost for an internal hackathon).

## Consequences

- Live positions may be wrong or manipulated; the ranked result cannot be. This trade-off must be stated honestly in the README and in-app, alongside what anti-cheat can and cannot prove.
- Rooms hold at most 5 racers at 2 messages per second each, which fits the Free-tier ceiling of 100 messages per second (~10–20 concurrent rooms).
- Race results need the keystroke log, which ties this decision to the retention policy in ADR-0005.
- The race text must be known server-side before validation, so texts come from our own licensed corpora, not from arbitrary user input.
