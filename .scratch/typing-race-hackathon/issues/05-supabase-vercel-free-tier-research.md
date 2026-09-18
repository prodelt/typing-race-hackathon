# 05 Research: What Supabase Free + Vercel Hobby can really carry

Type: research
Status: resolved
Blocked by: none

## Question

Verified from official docs and pricing as of September 2026: what can we run on Supabase Free plus Vercel Hobby, and what architecture gets the most out of them for mandatory sign-in, cloud progress, live races, group leaderboards, caching, and a documented vertical/horizontal scaling path?

**Supabase**
- Free-plan limits:
  - DB size, MAU, egress;
  - Realtime concurrent connections, messages per second and per month, channels;
  - Edge Function invocations;
  - project pausing on inactivity;
  - number of free projects.
- Auth: providers, anonymous sign-ins and linking, default SMTP rate limits.
- RLS patterns and their performance.
- Realtime: Broadcast vs Presence vs Postgres Changes; private-channel authorization; broadcast from the database.
- Leaderboards via materialized views / `pg_cron`.
- Connection pooling.
- Status and incident history, since sign-in availability is demo-critical under TZ §11.

**Vercel Hobby**
- Limits.
- Terms of service: the non-commercial clause vs a prize hackathon.
- Caching headers for static assets.
- Functions limits.
- Preview deployments.
- Env and secrets handling.
- Free analytics quotas.

**Scaling**
- Which layer scales how.
- Where caching belongs (CDN, service worker, client query cache, DB-side).
- The paid upgrade path.

**Existing assets**
- Read-only check of the user's existing Supabase organizations and projects.

## Deliverable

`docs/research/05-supabase-vercel.md` on `main` (folded from its research branch in `2dcaba0`).

## Answer

Resolved 2026-09-13 by a research subagent. Findings: `docs/research/05-supabase-vercel.md` on `main` (folded from its research branch in `2dcaba0`), with a source for every figure.

**Supabase Free**
- 2 active free projects per account. One slot is already used by a project from another effort, so **one slot is left**.
- 500 MB DB, 50k MAU, 5 GB egress, 500k Edge Function invocations.
- The project pauses after 1 week of inactivity.

**Realtime Free**
- 200 concurrent connections, 100 msg/s, 20 presence msg/s, 2M msg/month, 256 KB payload.
- **Throughput, not connections, is the binding limit:** roughly 10–20 concurrent 5-racer races at 1–2 progress updates/s, or 600–1,250 races/month. A jury demo uses under 5%.

**Auth**
- Built-in SMTP sends only to org team members, 2/hour, so it is unusable for jury sign-ups. Use password and/or OAuth (GitHub/Google), or custom SMTP.
- Per-IP limits (30 sign-ups per 5 min; anonymous sign-ins 30/hour) must be raised for a shared venue.

**Availability**
- No uptime SLA on Free or Pro.
- Recent Free-tier incidents:
  - Nano projects unresponsive, 10–11 Sep 2026;
  - OIDC sign-in failures, 18–19 Aug 2026;
  - refreshed JWTs rejected with 401, through 11 Sep 2026.
- Sign-in availability is therefore a real TZ §11 risk under ADR-0002.

**Vercel Hobby**
- 100 GB bandwidth, 1M edge requests, 1M function invocations, 300 s max duration, one region.
- **Personal or non-commercial use only.** "Commercial" is financial gain of *anyone* involved in production, and there is no official ruling on prize hackathons.
- Hobby cannot connect repos owned by a GitHub organization.

**Proposal** (input for tickets 11, 13 and 14, not yet decided)
- A static Vite SPA with no Vercel functions, keeping the build host-agnostic.
- A new Supabase Free project.
- Password + OAuth sign-in.
- Progress persisted locally, with an outbox sync.
- One private Realtime channel per race at 1–2 progress msgs/s; the server authors the start time and validates finishes.
- Leaderboards from summary tables updated per result, with a weekly reset via `pg_cron`.
- A documented one-command local Docker stack as the demo fallback.

**Surfaced**
- Ticket 19 (Vercel Hobby eligibility).
- Unverified points to test during implementation:
  - whether msg/s counts sends or deliveries;
  - whether `pg_cron` activity prevents pausing;
  - supabase-js session persistence and refresh behavior offline.
