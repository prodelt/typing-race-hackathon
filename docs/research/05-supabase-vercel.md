# 05 Research: What Supabase Free + Vercel Hobby can really carry

Status: complete (research agent, 2026-09-13). Primary sources only; unverifiable items marked UNVERIFIED.

## 1. Summary

- **Fit.** Supabase Free plus Vercel Hobby can carry the whole feature set at hackathon scale:
  - Sign-in: mandatory, on 50,000 MAU.
  - Progress: cloud sync in a 500 MB DB.
  - Races: live, on 200 concurrent Realtime connections, 100 msgs/s and 2 M msgs/month.
  - Leaderboards: group, weekly and global, server-backed.
  - Frontend: a static SPA on 100 GB transfer and 1 M edge requests.
- **Race capacity.** The binding Realtime limit is **100 messages/second per project**, not connections. With throttled Broadcast progress (1–2 Hz), Free supports about 10–20 concurrent 5-racer races and 600–1,250 races/month. That is far more than a jury demo needs.
- **Biggest risk: availability, not capacity.**
  - Free has no SLA (SLA is Enterprise only).
  - Projects pause after a low-activity week.
  - Nano (Free) projects went unresponsive on 10–11 Sep 2026, Free-tier OIDC sign-in failed on 18–19 Aug 2026, and refreshed JWTs were rejected with 401s through 11 Sep 2026.
  - With mandatory sign-in, TZ §11 ("mandatory functionality depends on an unavailable service") is the real exposure.
  - Mitigations: local-first training on a persisted session, a documented local Docker stack, pre-demo health checks, and daily activity.
- **Email is a trap.** Built-in SMTP sends only to org team members, 2/hour. Use password and/or OAuth for "new profile", or add custom SMTP (30/hour to start). Per-IP sign-up limits (30 per 5 min) must be raised for a shared venue.
- **Vercel Hobby terms are a grey zone.** Hobby is "personal or non-commercial use" only. Commercial means financial gain of *anyone* involved in production, and there is no official word on hackathon prizes. Get written confirmation from Vercel Support and keep the build host-agnostic. Paying for Pro would conflict with TZ §7.
- **Existing assets.** One Free org with one active eu-west-1 project from another effort. One free project slot remains.

## 2. Limits tables with sources

All numbers fetched 2026-09-13. Source keys like [S1] are listed in section 13.

### 2.1 Supabase Free (per project unless noted)

| Resource | Free | Pro (from $25/mo) | Source |
|---|---|---|---|
| Price | $0 | from $25/mo, includes $10/mo compute credit (Micro) | [S1] |
| Active free projects | 2 per org, paused ones do not count | n/a | [S1], [S2], [S3] |
| Compute | Nano: shared CPU, 0.5 GB RAM | Micro: 2-core shared, 1 GB (~$10/mo, covered by credit) | [S1], [S4] |
| Database size | 500 MB | 8 GB disk, then $0.125/GB | [S1], [S4] |
| Direct DB connections / pooler clients | 60 / 200 (Nano) | Micro: see [S4] | [S4] |
| Monthly active users | 50,000 | 100,000, then $0.00325/MAU | [S1], [S5] |
| Egress | 5 GB + 5 GB cached | 250 GB + 250 GB cached, then $0.09 / $0.03 per GB | [S1] |
| File storage | 1 GB | 100 GB, then $0.0213/GB | [S1] |
| Realtime concurrent connections | 200 | 500, then $10 per 1,000 | [S1], [S6] |
| Realtime messages / month | 2 million | 5 million, then $2.50 per million | [S1], [S7] |
| Realtime messages / second | 100 | 500 (2,500 with spend cap off) | [S6] |
| Realtime channel joins / second | 100 | 500 (2,500 with spend cap off) | [S6] |
| Channels per connection | 100 | 100 | [S6] |
| Presence messages / second | 20 | 50 (1,000 with spend cap off) | [S6] |
| Broadcast payload | 256 KB | 3,000 KB | [S6] |
| Postgres Changes payload | 1,024 KB | 1,024 KB | [S6] |
| Edge Function invocations | 500,000 / mo | 2 million, then $2 per million | [S1] |
| Edge Functions per project | 100 | 1,000 | [S8] |
| Edge Function wall clock / CPU / memory | 150 s / 2 s CPU / 256 MB | 400 s / 2 s CPU / 256 MB | [S8] |
| Inactivity pausing | Yes, low activity over 7 days | Never | [S1], [S9] |
| Backups | None downloadable | Daily, 7 days | [S1], [S10] |
| Log retention | 1 day | 7 days | [S1] |
| Support / SLA | Community, no SLA | Email support, no SLA (SLA is Enterprise only) | [S1], [S11] |
| Over-quota behaviour | Notice, grace period, then possible pause, read-only DB, or HTTP 402 on all API requests | Spend cap on by default; turn off to pay overage | [S12] |

Realtime message counting: each Broadcast counts as 1 sent plus 1 per receiving subscriber; each Postgres change counts 1 per listening client [S7].

### 2.2 Supabase Auth default rate limits

| Endpoint | Default | Configurable | Source |
|---|---|---|---|
| Emails (signup, recover, email change) with built-in SMTP | 2 per hour, project-wide; only delivers to org team-member addresses | Only by switching to custom SMTP | [S13], [S14] |
| Emails with custom SMTP | 30 per hour to start | Yes | [S14], [S10] |
| OTP sends (`/auth/v1/otp`) | 360 per hour | Yes | [S10] |
| OTP / magic link resend window | 60 s per user | Yes | [S13], [S10] |
| Sign-up and sign-in | 30 per 5 min per IP (burst 30) | Yes | [S13] |
| Token refresh | 1,800 per hour per IP (150 per 5 min, burst 30) | Yes | [S10], [S13] |
| Verify | 360 per hour per IP (burst 30) | Yes | [S10] |
| Anonymous sign-ins | 30 per hour per IP (burst 30) | Yes | [S10], [S13] |

### 2.3 Vercel Hobby

| Resource | Hobby | Pro ($20/mo, $20 usage credit) | Source |
|---|---|---|---|
| Use restriction | Non-commercial, personal use only | Commercial allowed | [V1], [V2], [V3] |
| Edge requests | Up to 1,000,000 / mo | 10 M, then from $2 per M | [V2], [V9] |
| Fast Data Transfer (bandwidth) | 100 GB / mo | 1 TB, then from $0.15/GB | [V4], [V9] |
| Fast Origin Transfer | Up to 10 GB | Usage-based | [V4] |
| Function invocations | 1,000,000 / mo | $0.60 per M | [V2], [V4] |
| Active CPU / provisioned memory | 4 CPU-hrs / 360 GB-hrs | Usage-based | [V2] |
| Function max duration (Fluid compute) | 300 s | 800 s (1,800 s beta) | [V5] |
| Function memory | 2 GB / 1 vCPU | up to 4 GB / 2 vCPU | [V5] |
| Function body size | 4.5 MB request/response | same | [V5] |
| Function regions | Single region (default `iad1`, changeable) | Multiple regions | [V5] |
| Function concurrency | auto-scales to 30,000 | 30,000 | [V5] |
| Build | 45 min max, 1 concurrent build, 2 vCPU / 8 GB | 45 min, up to 30 vCPU | [V2], [V4] |
| Deployments | 100 / day; 100 builds / hour | 6,000 / day | [V4] |
| Projects | 200 | Unlimited | [V2] |
| Git | Cannot connect to repos owned by a GitHub organization | Allowed | [V4] |
| Runtime logs | 1 hour | 1 day | [V2] |
| Env vars | 1,000 per environment, 64 KB total per deployment | same | [V4], [V6] |
| Web Analytics | 50,000 events / mo, 1 month data; collection pauses after grace, resumes after 7 days | on-demand | [V2] |
| Speed Insights | 10,000 events over last 30 days | $0.65 per extra unit | [V2], [V4] |
| Deployment protection | Vercel Authentication with Standard Protection (previews + generated URLs); production domain stays public | All Deployments; password is a $150/mo add-on | [V7] |
| WAF | 3 custom rules, 3 IP blocks | 40 / 100 | [V2] |
| Over-limit behaviour | Feature unavailable until 30 days pass | Billed on demand | [V2] |

## 3. Auth findings

### 3.1 Sign-in methods on Free

| Method | Sends email? | Demo speed | External dependency | Notes |
|---|---|---|---|---|
| Email + password, "confirm email" off | No | Fastest, no inbox step | None beyond Supabase | Production checklist recommends turning confirmations on [S10]. That this sends no email when confirmation is off is standard GoTrue behaviour, but I did not re-fetch it: UNVERIFIED this session. |
| Email OTP / magic link | Yes | Slow: inbox round trip, 60 s resend window [S13] | **Custom SMTP needed.** Built-in SMTP sends only to org team-member addresses, 2/hour, no SLA [S14] | Custom SMTP starts at 30 emails/hour, adjustable [S14]. Free tiers of SMTP providers: UNVERIFIED. Email scanners can consume single-use links [S10]. |
| OAuth GitHub / Google | No | Fast if the juror has an account | GitHub / Google availability | Counts toward MAU like any login [S5]. Automatic linking works only for verified same-email identities [S20]. |
| Anonymous sign-in | No | Instant | None | Creates a real `auth.users` row with an `is_anonymous` JWT claim. Upgrade via `updateUser()` (email) or `linkIdentity()` (OAuth; manual linking must be enabled) [S19], [S20]. 30/hour per IP by default; CAPTCHA/Turnstile recommended; no auto-cleanup [S19], [S10]. **Conflicts with ADR 0002 ("no guest mode")** unless that ADR is revisited. |

Whether anonymous users count as MAU is not stated [S19], [S5]. The MAU troubleshooting page counts "a distinct count of all user ids" with any auth event [S30], so they almost certainly count (inference). Either way, 50,000 MAU is irrelevant at hackathon scale.

### 3.2 Sessions and offline

- Access JWT defaults to 1 hour. Refresh tokens never expire, are single-use, and can be reused within 10 s [S21].
- Time-boxed sessions and inactivity timeouts are Pro-only, so Free sessions live until sign-out [S21].
- supabase-js: `persistSession` saves the session to local storage, and `autoRefreshToken` refreshes before expiry [S31]. The defaults (both `true`) and offline refresh-retry behaviour are not stated on the fetched page: UNVERIFIED. Prove them with an E2E test (go offline for more than 1 h, reload, return online).
- Consequence: once signed in, a learner can reload and keep training from local progress while Supabase is unreachable. Only cloud sync, races and leaderboards need the network. This is the main lever against the TZ §11 "unavailable service" clause.

### 3.3 Demo-critical risks and mitigations

| Risk | Evidence | Mitigation |
|---|---|---|
| Shared venue NAT hits per-IP limits (sign-up 30 per 5 min, anonymous 30/h) | [S13], [S10] | Raise the limits in Auth > Rate Limits before demo day. They are configurable on Free [S13]. |
| Built-in SMTP cannot email jurors | [S14] | Do not depend on email for the "new profile" step. Use password without confirmation, or OAuth. Add custom SMTP only if OTP is kept. |
| Free project paused after a low-activity week | [S9] | Warning email about a week ahead [S9]. Keep daily API traffic, for example a scheduled CI smoke test against production (API calls count as activity [S9]). Restore takes one click within 90 days [S9]. Whether `pg_cron` counts as activity: UNVERIFIED. |
| Nano (Free) projects became unresponsive, 10–11 Sep 2026 | [S28a] | Check the status page and the project the morning of the demo, and restart the project if it is unresponsive (the incident's own advice) [S28a]. |
| Free-tier OIDC `signInWithIdToken` failures, 18–19 Aug 2026 (Google/Apple/Firebase unaffected) | [S28b] | Prefer the standard OAuth redirect or password. Have two sign-in methods enabled. |
| Newly refreshed JWTs rejected with 401 (status feed: Aug 14 to Sep 11 2026, rolling fix) | [S28c] | The client must treat a 401 on sync as retryable, keeping local progress and the outbox. |
| No uptime SLA on Free or Pro (Enterprise only) | [S11] | Local fallback: `supabase start` runs Postgres, Auth, Realtime, Storage, Edge Runtime, Studio and Mailpit in Docker [S29]. Document a one-command local run (TZ §7 allows "one documented command"). |

## 4. Realtime race architecture options and capacity estimate

### 4.1 Primitives

| Primitive | Use for | Cost / scaling facts |
|---|---|---|
| **Broadcast** | Racer progress ticks, countdown, finish events | 1 billed message sent + 1 per receiving subscriber [S7]. Can be sent over REST without a socket, and from SQL via `realtime.send()` / `realtime.broadcast_changes()` [S16]. DB-originated broadcasts and Replay (messages kept 72 h to 4 days; 25 per request [S6]) require **private** channels [S16]. |
| **Presence** | Lobby roster (who is in the room, ready flag) | Free cap 20 presence msgs/s [S6]. Meant for slow-changing state; calling `track()` rapidly "will flood the channel" [S18]. |
| **Postgres Changes** | Avoid for races | Each change is authorised per subscriber (100 subscribers = 100 checks), on a single thread, so bigger compute does not help. Docs say to use Broadcast at scale [S17]. |

**Private-channel authorisation.**
- Setup: disable "Allow public access" and create channels with `config: { private: true }`. Access comes from RLS policies on `realtime.messages`, with `extension = 'broadcast' | 'presence'` and `realtime.topic()` [S15].
- Caching: policies are evaluated when a client joins and cached for the connection, not checked per message. Complex RLS lowers join rates [S15].
- DB pool: Realtime uses a separate pool for these checks, configurable in Realtime settings [S26].
- Rate settings: rate and payload settings are editable only with the spend cap disabled, so on Free they stay at plan defaults [S26].

### 4.2 Options

- **A. Client-relay Broadcast, server-authoritative edges (recommended).**
  - Room: a private channel `race:<id>`, with Presence for the roster.
  - Start: an RPC `start_race()` (SECURITY DEFINER) sets `starts_at = now() + interval '5 s'` and announces it with `realtime.send()`.
  - During the race: clients broadcast throttled progress (1–2 Hz or per word) straight to the channel.
  - Finish: an RPC `finish_race()` checks elapsed time against the server `starts_at`, sanity-caps WPM/accuracy, and writes the result.
  - Leaderboards and results are written only by RPCs. Clients never insert into them.
- **B. DB-mediated progress.** Clients write progress rows and triggers call `realtime.broadcast_changes()`. Every tick hits Nano Postgres (0.5 GB RAM, 60 connections [S4]). The documented DB-trigger benchmark tops out far below client Broadcast (10,000 vs 224,000 msgs/s on large clusters [S25]). Not worth it on Free.
- **C. Postgres Changes on a `race_progress` table.** Rejected: per-subscriber auth, single-threaded [S17].

### 4.3 Capacity on Free (Option A), estimate

Assumptions (mine, not from docs): 60 s race, `self: false`, about 100 extra billed messages per race for lobby, countdown and finish, and a payload under 1 KB. The per-second cap is assumed to count sends ("events per second that can be sent" [S26]). Whether fan-out deliveries also count toward it: UNVERIFIED, so the per-second figures could be up to n times lower.

| Scenario | Sends/s per race | Concurrent races under the 100 msg/s cap [S6] | Racers online (cap 200 connections [S6]) | Billed msgs per race [S7] | Races/month within 2 M [S1] |
|---|---|---|---|---|---|
| 5 racers @ 1 Hz | 5 | 20 (100 racers) | OK | 5·5·60 + 100 ≈ 1,600 | ≈ 1,250 |
| 5 racers @ 2 Hz | 10 | 10 (50 racers) | OK | ≈ 3,100 | ≈ 640 |
| 10 racers @ 1 Hz | 10 | 10 (100 racers) | OK | 10·10·60 + 100 ≈ 6,100 | ≈ 330 |

- **Binding limit:** messages per second, not connections. One supabase-js socket multiplexes up to 100 channels [S6], so each browser tab costs about 1 connection whatever rooms it joins.
- **Presence:** 20 msgs/s [S6] limits lobby churn to roughly 20 join/leave/ready events per second project-wide. Fine for a demo.
- **Overflow:** exceeding a limit disconnects clients with `too_many_*` errors, and they reconnect when traffic normalises [S6].
- **Demo:** a jury demo with 2–6 browsers uses under 5% of any Free limit.

## 5. Leaderboards

- **Write path.** An RPC `submit_result()` (SECURITY DEFINER, `search_path` pinned) validates the result and inserts into `results`. In the same transaction it upserts a best-score row in `leaderboard_weekly (scope, scope_id, week_start, user_id)`. This keeps reads O(page) on Nano. The server timestamp and server-side start make the rating "honestly server-backed" (TZ §10 bonus, §11).
- **Materialized views: not needed.** Materialized views "don't support RLS" [S27], so they must not sit in an API-exposed schema. If used, put them in a private schema, read them through a SECURITY DEFINER function returning only public columns, and refresh them with `pg_cron`. `REFRESH ... CONCURRENTLY` needs a unique index (PostgreSQL docs, not re-fetched: UNVERIFIED this session).
- **`pg_cron` (Supabase Cron).** Second-to-yearly schedules, SQL or HTTP (Edge Function) jobs. At most 8 concurrent jobs, each under 10 minutes, is recommended [S24]. Use it for the weekly rollover and optional MV refresh. Prune `cron.job_run_details`, which grows unbounded [S32]. Free-plan availability is not explicitly stated on [S24]: UNVERIFIED. It is a standard Postgres module on all projects in practice.
- **Indexes and RLS.** Index `(scope, scope_id, week_start, score desc)` and every column a policy filters on. Write `(select auth.uid())` instead of `auth.uid()`, always use `to authenticated`, and move membership checks such as "user in group" into SECURITY DEFINER helpers [S22]. No official benchmark numbers exist on the RLS performance page [S22b].
- **Live updates.** After the upsert, the RPC calls `realtime.send()` on a private `leaderboard:<group>` topic, so open leaderboards refresh without Postgres Changes [S16].
- **Global rating honesty.** A single server table read by all clients is genuinely global. Never fall back to a local list labelled "global" (TZ §11). If offline, label it "cached at <time>".

## 6. Caching strategy per layer

| Layer | What to cache | How | Source |
|---|---|---|---|
| CDN / static (Vercel) | Vite `assets/*` (hashed JS/CSS/fonts), content-hashed dictionaries and curriculum JSON | `vercel.json` header `Cache-Control: public, max-age=31536000, immutable` for hashed paths. Static files are cached at the edge for the deployment's lifetime automatically, and Vercel does not allow bypassing that. | [V8], [V10] |
| CDN / HTML | `index.html` | Keep Vercel's default `public, max-age=0, must-revalidate` so a new deploy is picked up immediately. SPA fallback rewrite `/(.*)` → `/index.html`. | [V8], [V11] |
| Service worker (PWA bonus, TZ §8.10) | App shell, fonts, dictionaries | Precache at install. Network-only for `*.supabase.co` auth, REST and Realtime. Library choice not researched. | TZ §8.10, §10 |
| Client memory | Keystroke loop state | Zustand. No network or storage in the sub-16 ms loop. | CLAUDE.md |
| Client persistent | Progress, results outbox, last leaderboard snapshot | IndexedDB/localStorage (required by TZ §4.1, §8.9). Outbox uses client-generated UUIDs so `submit_result` upserts are idempotent on retry. | TZ §4.1, §8.9 |
| API | Leaderboard reads | Supabase Data API responses are per-user (they carry an `Authorization` header), and requests with `Authorization` are not CDN-cacheable [V10]. Rely on a client query cache (stale time 30–60 s) plus Realtime invalidation. Optional later: a Vercel Function proxy with `s-maxage=30, stale-while-revalidate` for a public leaderboard. It must use a region near the DB (Hobby: one region, default `iad1`, changeable [V5]). | [V5], [V10] |
| DB | Aggregates | `leaderboard_weekly` table maintained on write, plus indexes. No MV needed at this scale. | [S22], [S27] |
| Realtime | Nothing persistent | Broadcast is ephemeral. Late joiners use Replay on private channels (72 h to 4 days, 25 messages per request). | [S16], [S6] |

## 7. Scaling path

| Layer | Horizontal | Vertical / plan | Official prices |
|---|---|---|---|
| Static SPA / CDN | Global edge network, automatic [V10] | Hobby 100 GB transfer and 1 M edge requests → Pro 1 TB and 10 M | Pro $20/mo with $20 usage credit; then from $0.15/GB and from $2 per M edge requests [V9] |
| Vercel Functions (optional) | Auto-scale to 30,000 concurrency [V5] | Hobby 2 GB/1 vCPU, 300 s, single region → Pro 4 GB/2 vCPU, 800 s, multi-region [V5] | $0.60 per M invocations; Active CPU from $0.128/h [V4] |
| Postgres | Read replicas (add-on, paid plans [S32]; price not fetched: UNVERIFIED); room/topic sharding is logical only | Nano (Free, 0.5 GB) → Micro ~$10 → Small ~$15 → Medium ~$60 → Large ~$110 → XL ~$210 → 2XL ~$410 → 4XL ~$960 /mo [S4] | Pro $25/mo includes $10 compute credit [S1], [S3] |
| Connections | Supavisor pooler; browsers use the Data API, never direct Postgres [S23] | Nano: 60 direct / 200 pooler clients [S4]; transaction mode (6543) for serverless [S23] | — |
| Realtime | Supabase-managed cluster; benchmarks show 224k msgs/s at 32k users [S25] | Free 200 conns / 100 msg/s → Pro 500 conns / 500 msg/s → Pro with spend cap off or Team: 10,000 conns / 2,500 msg/s [S6] | Pro: +$10 per 1,000 peak connections, +$2.50 per M messages [S1] |
| Auth | Managed | 50k → 100k MAU | $0.00325 per extra MAU [S5] |
| Edge Functions | Managed | 500k → 2 M invocations; wall clock 150 → 400 s [S1], [S8] | $2 per extra M [S1] |
| Next tier | — | Team from $599/mo (Supabase) [S1] | — |

## 8. Vercel terms verdict

**Verdict: grey zone, not clearly compliant. Resolve before the public URL is submitted.**

- **Terms.** "You shall only use the Services under a Hobby plan for your personal or non-commercial use." Vercel may "shut down and terminate projects or deployments using the Hobby plan without notice for any reason or no reason" [V3].
- **Definition.** Commercial usage is "any Deployment that is used for the purpose of financial gain of **anyone** involved in **any part of the production** of the project". The listed examples cover payments, ads, affiliate links, and being paid to build or host [V1].
- **Staff view.**
  - Amy Egan (Vercel, 2024-11-01): "Demo sites where no one makes money are generally fine" [V12a].
  - Anshuman Bhardwaj (Vercel, 2024-12-03): a site that promotes commercial services is commercial even without revenue [V12b].
- **Hackathons.** No official Vercel statement on hackathons or prize money was found (docs, terms, community search).
- **Reading.**
  - For compliance: the app has no payments or ads, nobody is paid to build it, and it is open source.
  - Against: a cash prize is plausibly "financial gain of anyone involved in the production".
- **Mitigations.**
  1. Ask Vercel Support in writing, as the guidelines invite [V1], and keep the reply in the repo docs.
  2. Keep the build host-agnostic (a pure static `dist/`, no Vercel Functions in mandatory paths), so the deploy can move in minutes.
  3. Keep the documented local run as the TZ §7 fallback.
- **Pro not recommended.** Upgrading to Pro ($20/mo [V9]) removes the question but conflicts with TZ §7, "do not require a paid service for the demo".
- **Git restriction.** Hobby cannot connect to repositories owned by a GitHub **organization** [V4]. The public repo must live under a personal account, or be deployed via CLI/CI.

## 9. Existing Supabase assets

Read-only MCP calls (`list_organizations`, `list_projects`, `get_organization`) on 2026-09-13. Nothing was created, modified, paused or restored.

| Org | Org id | Plan | Project | Ref | Region | Status | Postgres | Created |
|---|---|---|---|---|---|---|---|---|
| [redacted — another effort] | [redacted] | free | [redacted] | [redacted] | eu-west-1 | ACTIVE_HEALTHY | 17.6.1.127 | 2026-06-06 |

- The Free quota is 2 active projects, counted across all orgs where the user is Owner/Admin; paused projects do not count [S2], [S3]. **One free slot remains** for Typing-Race.
- The existing project appears to belong to another effort. Reusing it would mix schemas and share its pause/usage fate. A dedicated project is advisable.
- Its tables were not inspected (out of scope).

## 10. Proposed recommendation

1. **Hosting.** A static Vite SPA on Vercel Hobby, with no Vercel Functions on mandatory paths. Hashed assets are immutable; HTML uses the default revalidating cache; SPA rewrite. Resolve the Hobby terms question in writing (section 8).
2. **Backend.** A new dedicated Supabase Free project in the remaining slot, in an EU region near the jury (eu-central-1 vs eu-west-1 latency not researched). Every table has RLS with `(select auth.uid())` and `to authenticated`. All scoring writes go through SECURITY DEFINER RPCs.
3. **Auth.** Mandatory sign-in using email + password (no email dependency for the demo) plus GitHub/Google OAuth. Defer OTP/magic link until custom SMTP is chosen. Raise per-IP rate limits before the demo. Do not use anonymous sign-ins unless ADR 0002 is amended.
4. **Local-first core.** Progress lives in IndexedDB. The persisted session lets a signed-in learner reload and train while offline or during a Supabase outage. A results outbox syncs idempotently. The UI labels server-only features (races, leaderboards) as unavailable instead of faking them.
5. **Races.** Option A: private Broadcast channel per race, Presence for the lobby only, progress at ≤2 Hz, server-set start time, finish validated by RPC. Free capacity is about 10–20 concurrent 5-racer races and 600–1,250 races/month (section 4.3).
6. **Leaderboards.** Aggregate tables updated on write, `pg_cron` for weekly rollover, `realtime.send()` for live refresh. No MV unless read load demands it.
7. **Resilience.**
   - Traffic: daily production smoke E2E to generate activity (avoids pausing).
   - Demo morning: status and health check.
   - Fallback: one-command local stack (`supabase start` + dev server) documented in the README.
   - Testing: the same migrations run in the Playwright CI against local Supabase in Docker [S29].
8. **Scaling story.** CDN scales on its own. The DB scales vertically through compute sizes. Realtime scales via plan (Pro, then spend cap off, then Team). Prices are in section 7.

## 11. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Supabase outage or Nano unresponsiveness at demo time makes sign-in impossible, which triggers the TZ §11 disqualification clause | Medium (recent Nano and auth incidents [S28]) | Critical | Local-first training with persisted session; local Docker fallback; pre-demo health check; restart project |
| R2 | Vercel treats a prize hackathon as commercial and removes the Hobby deployment without notice [V3] | Low–Medium | High | Written confirmation from support; host-agnostic static build; local run |
| R3 | Free project paused after a quiet week (e.g. between submission and judging) [S9] | Medium | High | Daily smoke traffic; watch for the warning email; restore within 90 days |
| R4 | Per-IP auth rate limits at a shared venue [S13] | Medium | High | Raise limits before the demo |
| R5 | Built-in SMTP only reaches team members [S14] | High if OTP is used | High | Password/OAuth; custom SMTP if OTP stays |
| R6 | Realtime 100 msg/s cap hit during a crowded jury session [S6] | Low | Medium | Throttle ticks; limit room size; show a clear error on `too_many_*` |
| R7 | Free over-quota triggers a grace period, then read-only or 402 [S12] | Very low | High | Stay tiny: 500 MB DB, 5 GB egress; dictionaries served from Vercel, not Supabase |
| R8 | No backups on Free [S1], [S10] | Low | Medium | Migrations and seed in git; `pg_dump` before demo |
| R9 | Hobby cannot link a GitHub org-owned repo [V4] | Certain if the repo is org-owned | Low | Personal-account repo or CLI deploys |
| R10 | JWT refresh edge cases or 401s (open incident through Sep 11 [S28c]) | Medium | Medium | Retryable sync, re-auth prompt without losing local progress |

## 12. Open questions

1. **ADR 0002 vs TZ §11.** Is "sign in once, then training survives backend outages" acceptable, given that the jury's "new profile" step (§9.1) still needs Supabase live? Or should the ADR allow an offline/local profile fallback? Decide in the accounts/sync ticket.
2. **Vercel and prize money.** Will we ask Vercel Support, and what is the fallback host if the answer is no? Alternative hosts' terms were not researched.
3. **Demo sign-in method.** Password (confirmation off or on) vs OAuth vs OTP. If OTP, which SMTP provider? Its free-tier limits are UNVERIFIED.
4. **Anonymous sign-ins.** Should they be allowed as a fast onboarding step that forces linking before races or ratings? That would amend ADR 0002.
5. **Supabase project.** New project in the last free slot, or a new Free org? Which EU region?
6. **Realtime per-second cap.** Does it count sends only or fan-out deliveries? UNVERIFIED; load-test on the real project.
7. **Pausing activity.** Does `pg_cron` or Realtime traffic count as "activity" for pausing? UNVERIFIED.
8. **supabase-js defaults.** Are `persistSession` and `autoRefreshToken` on by default, and how does offline refresh-retry behave? UNVERIFIED; cover with E2E.
9. **Server-side result validation.** How much is enough for an "honest" rating: a timing check only, or keystroke-log plausibility?

## 13. Sources

Fetched 2026-09-13 unless noted.

**Supabase**
- [S1] Pricing — https://supabase.com/pricing
- [S2] About billing on Supabase — https://supabase.com/docs/guides/platform/billing-on-supabase
- [S3] Billing FAQ (free projects, compute credits) — https://supabase.com/docs/guides/platform/billing-faq
- [S4] Compute and disk — https://supabase.com/docs/guides/platform/compute-and-disk
- [S5] Manage MAU usage — https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users
- [S6] Realtime limits — https://supabase.com/docs/guides/realtime/limits
- [S7] Realtime messages usage — https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages
- [S8] Edge Function limits — https://supabase.com/docs/guides/functions/limits
- [S9] Project pausing — https://supabase.com/docs/guides/platform/free-project-pausing
- [S10] Production checklist (auth rate-limit table, SMTP, backups) — https://supabase.com/docs/guides/deployment/going-into-prod
- [S11] SLA — https://supabase.com/sla
- [S12] Billing FAQ, Fair Use Policy — https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy
- [S13] Auth rate limits — https://supabase.com/docs/guides/auth/rate-limits
- [S14] Custom SMTP — https://supabase.com/docs/guides/auth/auth-smtp
- [S15] Realtime authorization — https://supabase.com/docs/guides/realtime/authorization
- [S16] Broadcast — https://supabase.com/docs/guides/realtime/broadcast
- [S17] Postgres Changes — https://supabase.com/docs/guides/realtime/postgres-changes
- [S18] Presence — https://supabase.com/docs/guides/realtime/presence
- [S19] Anonymous sign-ins — https://supabase.com/docs/guides/auth/auth-anonymous
- [S20] Identity linking — https://supabase.com/docs/guides/auth/auth-identity-linking
- [S21] Sessions — https://supabase.com/docs/guides/auth/sessions
- [S22] RLS — https://supabase.com/docs/guides/database/postgres/row-level-security ; [S22b] RLS performance — https://supabase.com/docs/guides/database/postgres/row-level-security-performance
- [S23] Connecting to Postgres — https://supabase.com/docs/guides/database/connecting-to-postgres
- [S24] Supabase Cron — https://supabase.com/docs/guides/cron
- [S25] Realtime benchmarks — https://supabase.com/docs/guides/realtime/benchmarks
- [S26] Realtime settings — https://supabase.com/docs/guides/realtime/settings
- [S27] Advisor lint 0002 (views and materialized views vs RLS) — https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0002_auth_users_exposed
- [S28] Status incidents: history feed https://status.supabase.com/history.atom ; [S28a] Unresponsive (Nano) projects — https://status.supabase.com/incidents/4mkcsnlf6p5x ; [S28b] Free-tier OIDC sign-in failures — https://status.supabase.com/incidents/1kzddpb0fhwr ; [S28c] Refreshed JWTs rejected (401) — https://status.supabase.com/incidents/6q5902p2xd9f (read via feed only)
- [S29] Local development CLI — https://supabase.com/docs/guides/local-development/cli/getting-started
- [S30] Check MAU usage (troubleshooting) — https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs
- [S31] supabase-js initializing — https://supabase.com/docs/reference/javascript/initializing
- [S32] Upgrading (pg_cron job_run_details growth) — https://supabase.com/docs/guides/platform/upgrading ; read replicas mention in [S10]

**Vercel**
- [V1] Fair use guidelines (commercial usage) — https://vercel.com/docs/limits/fair-use-guidelines
- [V2] Hobby plan — https://vercel.com/docs/plans/hobby
- [V3] Terms of Service — https://vercel.com/legal/terms
- [V4] Limits — https://vercel.com/docs/limits
- [V5] Functions limits — https://vercel.com/docs/functions/limitations
- [V6] Environment variables — https://vercel.com/docs/environment-variables
- [V7] Deployment protection — https://vercel.com/docs/deployment-protection
- [V8] Cache-Control headers — https://vercel.com/docs/caching/cache-control-headers
- [V9] Pricing — https://vercel.com/pricing
- [V10] CDN cache — https://vercel.com/docs/caching/cdn-cache
- [V11] Vite on Vercel (SPA rewrites) — https://vercel.com/docs/frameworks/frontend/vite
- [V12a] Community, staff reply (Amy Egan) — https://community.vercel.com/t/question-on-fair-use-and-hobby-plan-suitability-for-demo-commercial-websites-in-portfolio/1769 ; [V12b] Community, staff reply (Anshuman Bhardwaj) — https://community.vercel.com/t/fair-use-of-the-hobby-plan/2725
- [V13] Vercel status history — https://www.vercel-status.com/history.atom (Jun–Sep 2026: short CDN/Functions degradation in iad1/cle1 on 2 Jul, build delays 8–10 Jul; no EU/DNS incidents listed)

**Environment and secrets notes (Vercel)**
- Env vars are encrypted at rest, scoped per Production/Preview/Development, and apply only to new deployments; limit 64 KB total [V6].
- Anything prefixed `VITE_` is compiled into the public bundle (Vite behaviour). Only the Supabase URL and publishable/anon key belong there. The service-role key must never reach Vercel env for the SPA, and stays in GitHub Actions secrets for CI only.
- Hobby preview deployments are protected by Vercel Authentication under Standard Protection; the production domain stays public [V7].
