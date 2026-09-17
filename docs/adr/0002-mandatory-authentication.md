---
status: accepted
---

# Mandatory authentication for every learner

Every learner signs in (Supabase Auth) before training; there is no guest mode. Chosen on 2026-09-13 to ship a fully online, competitive product with cloud progress, live races and group ratings, instead of a local-first trainer. This deliberately deviates from the TZ default that progress is stored locally (§6).

## Consequences

- TZ §4.1 and automated check §8.9 still require progress to survive browser restarts, so the browser keeps a local copy of progress alongside the cloud record.
- TZ §11 disqualifies work whose mandatory functionality depends on a service unavailable during the demo. Sign-in availability is therefore demo-critical and needs explicit mitigation.
- The jury demo opens with "a new profile" (§9.1), so account creation must be fast and must not hinge on a slow or rate-limited step.
- A privacy page and self-service profile deletion are mandatory (§6, §11).
- How these are met is decided in the wayfinder ticket "Accounts, sync & privacy under mandatory authentication".
