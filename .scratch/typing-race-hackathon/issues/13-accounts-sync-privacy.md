# 13 Grilling: Accounts, sync & privacy under mandatory authentication

Type: grilling
Status: resolved
Blocked by: 05, 11

## Question

Every learner must sign in (`docs/adr/0002-mandatory-authentication.md`). How do we make that work while still satisfying the TZ?

- **Sign-in methods:** email magic link, OAuth, or anonymous-then-link. Also how the jury's "new profile" demo step (§9.1) stays fast.
- **Local persistence:** how progress still survives browser restarts locally (§4.1, automated check §8.9).
- **Availability:** what happens when Supabase Auth or DB is unreachable (§11 disqualification risk), including keeping the project from pausing.
- **Multi-device sync:** conflict rules for progress edited on several devices.
- **Access control:** the RLS model.
- **Practical constraints from research 05 §3:**
  - built-in SMTP only reaches team members at 2/hour. **Decided:** email goes through Resend as custom SMTP. Still open: which email flows (password, magic link/OTP) and whether to add OAuth;
  - per-IP sign-up limits;
  - anonymous sign-ins would amend ADR-0002.

  Internal hackathon: no outage-hardening work.
- **Privacy:**
  - the exact personal data collected and the privacy page;
  - self-service profile deletion (§6);
  - consent.

## Answer

## Decisions — grilling round (2026-09-17)

- **Source of truth:** attempts form an append-only log. Curriculum progress and per-key/per-transition confidence are **derived**, recomputed server-side when an attempt is inserted. Two devices only ever append rows, so cross-device conflicts cannot occur by construction. This is the same event log the metrics and ADR-0004 rest on, so there is one data model rather than two.
- **Keystroke-log retention:** the full log is kept for a user's last 20 attempts; aggregates (SPM, accuracy, per-character errors, per-key and per-transition latency, rhythm) are kept forever. Logs older than 30 days are pruned by a scheduled job. Replay is needed for recent results and race validation, not for all history, and the Free-tier database is 500 MB.
- **Local persistence under mandatory sign-in:** progress and the current exercise are cached in IndexedDB keyed by user; unsent attempts go into an outbox queue that drains when the network returns; after a reload the page renders from cache without waiting for the server. This is how TZ §4.1 and automated check §8.9 pass even offline.
- **Privacy:**
  - collected: email, nickname, chosen layout and language, attempts with their metrics, group membership;
  - not collected: any third-party analytics or trackers;
  - a nickname is mandatory at first sign-in because it appears on leaderboards; no avatars, just initials;
  - profile deletion is self-service via a Supabase Edge Function (the client may not delete an Auth user), cascading through the data;
  - the privacy page states this in plain language, including that we store inter-keystroke intervals.

- **Sign-in methods:** email and password with email confirmation disabled, so a profile is created instantly (needed for the §9.1 jury demo), plus OAuth via Google and GitHub. Resend serves only password resets and system mail, never the daily sign-in path, so mail-delivery latency can never block a login. Auth flow is PKCE rather than Supabase's default implicit. Magic link was rejected: on a demo it turns into "let me go open my inbox".

Resolved 2026-09-17.
