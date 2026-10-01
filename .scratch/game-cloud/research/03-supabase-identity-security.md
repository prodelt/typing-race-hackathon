# Supabase identity and security toolkit — research

Ticket: `.scratch/game-cloud/issues/03-supabase-identity-security-research.md`.
Sources: primary docs only (supabase.com/docs, Supabase GitHub, Google Cloud docs, Vercel docs,
MDN). Account identifiers are placeholders: `<project-ref>`, `<prod-domain>`, `<preview-domain>`.

## 0. Current state of the repo

Branch base: `main` at `fafd588`.

- **One client, anonymous auth, implicit flow.** `apps/web/src/sync/race.ts:160-178` creates the
  page's only Supabase client with `persistSession`/`autoRefreshToken` and a custom `storageKey`;
  no `flowType` is set, so it runs supabase-js's default `implicit` flow (see §1).
  `race.ts:227-233` signs in with `signInAnonymously({ options: { data: { nickname } } })`.
  supabase-js is `^2.117.2` (`apps/web/package.json:8`). Env: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (`race.ts:133-134`).
- **Auth config (local).** `supabase/config.toml:159` `site_url = "http://localhost:5173"`,
  `:163` redirect list holds only localhost:5173/4173, `:178` `enable_anonymous_sign_ins = true`,
  `:180` `enable_manual_linking = false`, `:203` `anonymous_users = 30` per hour per IP. No
  `[auth.external.google]` block exists (only Apple, `:322`). Hosted-project settings are set in the
  dashboard and are not visible from the repo.
- **Profiles.** `profiles.id references auth.users (id) on delete cascade`
  (`supabase/migrations/20260930120000_core.sql:23`), created by an `after insert on auth.users`
  trigger (`core.sql:46-66`, replaced in `20261001100000_groups_leaderboards.sql:22`). Every
  user-owned table references `profiles(id) on delete cascade` (`core.sql:76,117,139`;
  `20260930130000_races.sql:26,32,103,138,291,299,310`), `race_results.attempt_id` is
  `on delete set null` (`races.sql:139`).
- **RLS.** Enabled on every table; owner reads use `auth.uid() = user_id` **without** the
  `(select …)` wrapper (`core.sql:39,42,106,132,155`). There are **no** client insert/update/delete
  policies on attempts (`core.sql:102-106`) — writes go through Edge Functions or
  `security definer` RPCs. Realtime channel policies already use `(select realtime.topic())`
  (`20261001090000_race_flow.sql:375-387`). `lb_global`/`lb_weekly` are readable by
  `authenticated` (`races.sql:326-327`); the public board is a `security definer` RPC
  `public.leaderboard(...)` readable without sign-in for `all`/`week`
  (`groups_leaderboards.sql:243-260`). No policy checks `is_anonymous`.
- **Edge Functions.** `submit-attempt`, `finish-race`, both `verify_jwt = true`
  (`config.toml:390-396`), CORS `Access-Control-Allow-Origin: *` (`supabase/functions/_shared/cors.ts:6-10`).
  No rate limiting in either function (no matches for rate/limit/throttle).
- **Vercel.** `vercel.json:7-13` sets only `Cache-Control` headers; **no CSP, HSTS or other
  security headers.**

## 1. Anonymous sign-in, then `linkIdentity` with Google

**Flow.**

1. `supabase.auth.signInAnonymously()` creates a real `auth.users` row with role `authenticated`
   and `is_anonymous = true` in the JWT. (https://supabase.com/docs/guides/auth/auth-anonymous)
2. To convert to a permanent user with an OAuth identity, call
   `supabase.auth.linkIdentity({ provider: 'google' })` while signed in as the anonymous user.
   (https://supabase.com/docs/guides/auth/auth-anonymous,
   https://supabase.com/docs/guides/auth/auth-identity-linking)
3. The browser is redirected to Google; after consent Google returns to the Supabase callback, and
   Supabase redirects back to the app "and the Google identity will be linked to the user".
   (https://supabase.com/docs/guides/auth/auth-identity-linking)
4. The user id **does not change**; on the server the link clears `is_anonymous` on the same user
   (`targetUser.IsAnonymous = false`) inside `linkIdentityToUser`.
   (https://github.com/supabase/auth/blob/master/internal/api/identity.go) So all rows keyed on
   `auth.uid()` survive the upgrade with no migration.

`linkIdentity` "supports the PKCE flow" and returns `{ data: { url }, error }`; options mirror
`signInWithOAuth` (`redirectTo`, `scopes`, `queryParams`, `skipBrowserRedirect`).
(https://supabase.com/docs/reference/javascript/auth-linkidentity) There is also an ID-token
variant `linkIdentity({ provider: 'google', token, access_token })` for native / Google Identity
Services flows. (https://supabase.com/docs/guides/auth/auth-identity-linking)

**Required settings.**

- Anonymous sign-ins enabled (dashboard Auth settings; `enable_anonymous_sign_ins` locally).
  Otherwise `anonymous_provider_disabled`. (https://supabase.com/docs/guides/auth/debugging/error-codes)
- **Manual linking enabled** — "Manual linking is required and 'enable manual linking' must be
  configured"; it is disabled by default. Dashboard: Auth settings; self-hosted env
  `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true`; local `enable_manual_linking = true` in
  `config.toml`. Without it: `manual_linking_disabled`.
  (https://supabase.com/docs/guides/auth/auth-anonymous,
  https://supabase.com/docs/guides/auth/auth-identity-linking,
  https://supabase.com/blog/supabase-auth-identity-linking-hooks,
  https://supabase.com/docs/guides/auth/debugging/error-codes)
- Google provider enabled with client id/secret (§3); otherwise `provider_disabled`.
- The app URL (and `redirectTo`, if passed) must be in Site URL / Additional Redirect URLs.
  Globs are allowed: `http://localhost:5173/**`, `https://*-<team-slug>.vercel.app/**` for
  previews. (https://supabase.com/docs/guides/auth/redirect-urls)

**Redirect handling in an SPA.**

- supabase-js defaults: `flowType: 'implicit'`, `detectSessionInUrl: true`
  (https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts).
  With implicit flow the session returns in the URL fragment and the client picks it up on
  initialisation; with `flowType: 'pkce'` the client stores a code verifier locally and exchanges
  `?code=` automatically when `detectSessionInUrl` is on, or manually via
  `exchangeCodeForSession(code)`. The code is valid 5 minutes, single use, and must be exchanged
  in the same browser that started the flow. (https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- Recommendation for us: switch the client to `flowType: 'pkce'` (tokens never sit in the URL
  fragment / history), keep `detectSessionInUrl: true`, pass
  `redirectTo: location.origin + '/account'` (or the current route), and listen to
  `onAuthStateChange` (`USER_UPDATED` / `SIGNED_IN`) to refresh the UI. Because our SPA has a
  catch-all rewrite (`vercel.json:6`) any return path renders the app.
- Errors on return: supabase-js parses `error`/`error_code` from the redirect URL; for
  `identity_already_exists`, `identity_not_found`, `single_identity_not_deletable` it **returns
  the error early without removing the existing session**
  (https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts),
  i.e. the user stays signed in as the anonymous user. Read it from the result of
  `initialize`/`getSession` or parse `location` yourself, then clean the URL with
  `history.replaceState`.

**Versions.** `linkIdentity`/`unlinkIdentity`/`getUserIdentities` shipped with the identity
linking launch of 2023-12-14 (https://supabase.com/blog/supabase-auth-identity-linking-hooks);
anonymous sign-ins are in supabase-js v2 (https://supabase.com/docs/guides/auth/auth-anonymous).
Our `^2.117.2` has both, plus the error-code handling quoted above. No upgrade needed.

## 2. Second device: the Google identity already belongs to another user

**Behaviour.** "If the candidate identity is already linked to the existing user or another
user, `link_identity()` will fail." (https://supabase.com/docs/reference/python/auth-linkidentity)
Server side this is `422 Unprocessable Entity`, code `identity_already_exists`, message
"Identity is already linked to another user"
(https://github.com/supabase/auth/blob/master/internal/api/identity.go;
code listed at https://supabase.com/docs/guides/auth/debugging/error-codes). Because the OAuth
round-trip is a redirect, the error arrives as parameters on the return URL, not as a rejected
promise of the `linkIdentity` call. supabase-js keeps the current (anonymous) session in that case
(see §1). Community confirmation that this is the observed anonymous-user case:
https://github.com/supabase/auth/issues/1762.

**Documented recommended approach.** Supabase's anonymous-users guide, section "Resolving identity
conflicts": detect the conflict, sign in to the existing account, and **reassign the anonymous
user's data in your own code** (`resolveDataConflicts(anonUserId, existingUserId)`); there is no
built-in merge. (https://supabase.com/docs/guides/auth/auth-anonymous) The guide's example uses
email/password, but the pattern for Google is the same:

1. Before redirecting, remember the anonymous user id and its access token (or have the server
   issue a short-lived, signed "merge ticket" for that id) — once the user signs in as the
   existing account the anonymous session is replaced.
2. On `identity_already_exists`, call `signInWithOAuth({ provider: 'google' })`; the user returns
   signed in as the existing account.
3. Call a server-side merge (Edge Function with the service role) that verifies **both** the new
   session (caller JWT) and proof of owning the anonymous id (the old JWT, still verifiable until
   expiry, or the ticket), moves/merges rows (`attempts`, `progress`, `keystroke_logs`, races, group
   memberships, leaderboard rows — resolving unique-key conflicts with "best of"/sum rules), then
   deletes the anonymous `auth.users` row (cascade does the rest, §6).

Never trust a client-supplied "old user id" alone — that would let anyone steal another learner's
history. The anonymous rows are otherwise orphaned: "No automatic cleanup exists" for anonymous
users. (https://supabase.com/docs/guides/auth/auth-anonymous)

## 3. Google Cloud OAuth client for Supabase

All steps from https://supabase.com/docs/guides/auth/social-login/auth-google unless noted.

- **Where.** Create/choose a Google Cloud project, then the Google Auth Platform console
  (https://console.cloud.google.com/auth/overview): Audience, Data Access (scopes), Branding,
  Clients.
- **Audience / user type.** External = any Google account; Internal = only your Workspace/Cloud
  Identity org. (https://support.google.com/cloud/answer/15549945) We need External.
- **Scopes.** `openid` (add manually), `.../auth/userinfo.email`, `.../auth/userinfo.profile`
  (defaults). "If you add more scopes, especially those on the sensitive or restricted list your
  application might be subject to verification which may take a long time."
- **Branding.** App name, logo, support email, authorized domains. Supabase "strongly recommends"
  a custom domain, because otherwise the consent screen shows `<project-ref>.supabase.co`, "which
  does not inspire trust". Brand verification can take several business days.
- **Client.** Clients → Create → type **Web application**
  (https://console.cloud.google.com/auth/clients).
  - *Authorized JavaScript origins*: the app origins — "These should also be configured as the
    Site URL or redirect configuration in your project"; add `http://localhost:<port>` for local
    dev and remove it in production. (Strictly only needed for Google's own JS libraries / ID-token
    flow; harmless for the redirect flow.)
  - *Authorized redirect URIs*: **the Supabase callback**, shown on the dashboard's Google provider
    page: `https://<project-ref>.supabase.co/auth/v1/callback` (or
    `https://<custom-auth-domain>/auth/v1/callback`); for the local stack
    `http://127.0.0.1:54321/auth/v1/callback`. The app's own URLs do **not** go here — Google
    returns to Supabase, Supabase returns to the app (redirect allow list, §1).
  - Google's rules: HTTPS only (localhost exempt), no wildcards, no fragments, no userinfo, no raw
    IPs except localhost. (https://developers.google.com/identity/protocols/oauth2/web-server)
    Hence Vercel preview URLs can never be Google redirect URIs — fine, since only the Supabase
    callback is registered with Google; previews are allowed on the Supabase side by glob.
- **Supabase side.** Paste Client ID + Client Secret into Dashboard → Authentication → Providers
  → Google. Locally:
  ```toml
  [auth.external.google]
  enabled = true
  client_id = "<client-id>"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
  skip_nonce_check = false
  ```
  (`skip_nonce_check` is commented in our `config.toml:332` as "Required for local sign in with
  Google auth" — that applies to the ID-token flow, not the redirect flow.)
- **Publishing status** (https://support.google.com/cloud/answer/15549945):
  - *Testing*: "limited to up to 100 test users listed in the OAuth consent screen";
    "Authorizations by a test user will expire seven days from the time of consent". Non-listed
    accounts cannot sign in. Fine for a closed demo, not for a public app.
  - *In production*: available to all Google accounts after pressing Publish; "may be subject to
    verification before its name and logo are displayed" or before sensitive/restricted scopes can
    be requested. With only `openid`/email/profile no scope verification is triggered (Supabase
    note above); a logo on the consent screen triggers brand verification. Unverified apps with
    sensitive scopes show warnings and a 100-user cap.
  - Verification is not needed for personal-use apps (<100 users) or dev/testing/staging
    projects. (https://support.google.com/cloud/answer/13464323)
  - Practical choice: publish **In production** with the three basic scopes and **no logo**
    (name only) to avoid any wait; add logo + brand verification later if wanted.

## 4. RLS patterns

Sources: https://supabase.com/docs/guides/database/postgres/row-level-security (RLS),
https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv (perf),
https://supabase.com/docs/guides/auth/auth-anonymous (anonymous).

**Per-user private rows** — always name the role and wrap `auth.uid()`:

```sql
create policy attempts_select_own on public.attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- insert: with check ((select auth.uid()) = user_id)
-- update: using (...) with check (...)   -- with check stops re-assigning user_id
-- delete: using (...)
```

Index every column a policy filters on (`user_id` leading in a btree). (RLS doc)

**Public read of leaderboard aggregates.** Pattern: `for select to anon, authenticated using
(true)` on a table that holds *only* public columns, granting `select` only. "A policy that reads
to anon using (true) grants every unauthenticated visitor read access to every row." (RLS doc)
Views bypass RLS by default; on Postgres 15+ create them `with (security_invoker = true)`, or keep
them out of exposed schemas / revoke `anon`,`authenticated`. (RLS doc) Our alternative — a
`security definer` RPC that returns only public fields (`groups_leaderboards.sql:248`) — is
equally valid and lets us keep `profiles` private; it just must be written carefully (fixed
`search_path = ''`, which we do) because it bypasses RLS. Functions used in RLS or exposed in
`public` "can be called from the API" — move helpers whose result would leak into a non-exposed
schema. (perf doc) Today `is_group_member`, `is_race_participant`, `race_topic_allowed` live in
`public` (`races.sql:43,118`; `race_flow.sql:365`); they leak only a boolean about the caller,
acceptable, but the advisors will list them (§8).

**`auth.uid()` performance tip.** Write `(select auth.uid())`, not `auth.uid()`: Postgres runs it
once as an `initPlan` and caches the value for the statement instead of calling it per row.
Benchmarks: 179 ms → 9 ms; with a helper function 11 000 ms → 10 ms; indexing `user_id`
171 ms → <0.1 ms; `to authenticated` when `anon` queries: 170 ms → <0.1 ms. Only valid when the
value does not depend on the row. (perf doc) Our current policies (`core.sql:39,42,106,132,155`)
use the unwrapped form and omit `to authenticated` — a cheap fix migration.

**Anonymous vs permanent users.** Anonymous users use the `authenticated` role; distinguish them
via the JWT claim, typically as a **restrictive** policy layered over the permissive ones:

```sql
create policy "Only permanent users can post"
on news_feed as restrictive for insert
to authenticated
with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);
```

(anonymous doc) Use it for anything we want to gate behind Google (e.g. appearing on the public
board, creating groups). Do not authorise on `raw_user_meta_data` — the user can edit it; use
`raw_app_meta_data` for roles. (RLS doc) Relevant to us: `handle_new_user` reads `nickname`
(and `is_test`) from user metadata (`core.sql:46-60`); `profiles_keep_test_flag`
(`groups_leaderboards.sql:47`) already guards the flag after insert.

## 5. Rate limiting

**Edge Functions — documented options.**

- **Upstash Redis** (`@upstash/ratelimit` over Upstash's HTTP Redis client), keyed by the
  Supabase Auth user id or by IP. This is the one official Edge Function example.
  (https://supabase.com/docs/guides/functions/examples/rate-limiting) Adds a third-party service
  and a secret.
- **Data API (PostgREST) pre-request function** — `pgrst.db_pre_request` checking a
  `private.rate_limits` table keyed by `split_part(x-forwarded-for, ',', 1)`; only `POST/PUT/PATCH/
  DELETE` can be limited ("GET and HEAD requests run in read-only mode"), and it applies only to
  Data API requests, so it covers our RPCs (`rpc/join_quick_match` etc. are POSTs) but not Edge
  Functions. (https://supabase.com/docs/guides/api/securing-your-api)
- Not a documented Supabase pattern but derivable from the above: inside `submit-attempt` /
  `finish-race`, which already hold a service-role client (`submit-attempt/index.ts:141`), count
  the caller's rows in the last N seconds (`attempts.user_id`, `created_at`) and return 429. Our
  writes are already per-user and idempotent (`submit-attempt/index.ts:35,210`), so a per-user
  window in Postgres is enough for a hackathon; Upstash only if we need IP-level limiting.
- `verify_jwt = true` (`config.toml:390-396`) already rejects calls without a valid project JWT.

**Auth built-in limits** (https://supabase.com/docs/guides/auth/rate-limits):

| Operation | Default | Scope |
|---|---|---|
| Emails (built-in SMTP) | 2 / hour | project (raise via custom SMTP) |
| SMS | 30 / hour | project |
| Sign-ups + sign-ins (incl. OAuth) | 30 / 5 min | IP |
| **Anonymous sign-ins** | **30 / hour** | IP |
| Token refresh | 150 / 5 min | IP |
| Verifications | 30 / 5 min | IP |
| MFA challenges | 15 / min (fixed) | IP |
| Web3 | 30 / 5 min | IP |

Changed in Dashboard → Authentication → Rate Limits or via Management API `PATCH /config/auth`;
locally `[auth.rate_limit]` (`config.toml:197-211`). Exceeding gives `over_request_rate_limit`
(https://supabase.com/docs/guides/auth/debugging/error-codes). **Jury risk:** everybody on one
office NAT shares the 30 anonymous sign-ins per hour — raise it before the demo.

**CAPTCHA.** Supabase "strongly recommends" invisible CAPTCHA or Cloudflare Turnstile for
anonymous sign-ins (https://supabase.com/docs/guides/auth/auth-anonymous). Enable under Auth →
Bot and Abuse Protection (hCaptcha or Turnstile, secret key), then pass `options: { captchaToken }`
to the auth call (https://supabase.com/docs/guides/auth/auth-captcha). Turnstile would also need
CSP entries (§7). Optional for us.

## 6. "Delete my data"

**API.** `supabase.auth.admin.deleteUser(id, shouldSoftDelete)` — "Requires a `service_role`
key", "should only be called on a server. Never expose your `service_role` key in the browser."
(https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) A hard delete
(`shouldSoftDelete: false`, the default) removes the `auth.users` row and invalidates sessions
and refresh tokens; soft delete "only blocks sign-in … and does not revoke existing sessions".
(https://supabase.com/docs/guides/auth/managing-user-data)

**Cascade.** Tables referencing `auth.users` must use `on delete cascade`, "without this … deleting
a user will fail"; users who own Storage objects cannot be deleted until those objects are removed
or reassigned. (https://supabase.com/docs/guides/auth/managing-user-data)

**Our schema is already shaped for it:** `auth.users` → `profiles` cascade (`core.sql:23`), and
every user-owned table cascades from `profiles` (§0). Deleting the auth user therefore removes
attempts, keystroke logs, progress, memberships, race participation/results, leaderboard rows and
**groups the user owns** (`races.sql:26` — the group disappears for its other members; decide
whether that is wanted or ownership should transfer first). Race rooms keep existing with
`host_id` nulled (`race_flow.sql:48`). We use no Storage.

**Button design.** New Edge Function `delete-account` (`verify_jwt = true`):

1. Read the caller from the JWT with an anon-key client (`auth.getUser()`), never from the body.
2. Optionally require a fresh confirmation (typed nickname) in the UI.
3. With a service-role client: `auth.admin.deleteUser(user.id)`.
4. Client then calls `supabase.auth.signOut({ scope: 'local' })` and clears its local caches /
   IndexedDB, since already-issued access tokens are JWTs that stay valid until `exp`
   (`jwt_expiry = 3600`, `config.toml:165`) — harmless once the rows are gone.

Same function serves anonymous users (who have no other way to erase themselves) and the merge
step of §2 (delete the anonymous user after moving its data). For periodic cleanup of abandoned
anonymous users the docs give
`delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';`
(https://supabase.com/docs/guides/auth/auth-anonymous) — could run from `pg_cron`.

## 7. CSP and HSTS on Vercel

**What the app actually talks to.**

- Own origin: JS/CSS/fonts/`sw.js`. The built `index.html` has **no inline scripts or styles** —
  one `<script type="module" src="/assets/…">` plus `modulepreload`/stylesheet links (checked on
  a local `apps/web/dist/index.html`), so `script-src 'self'` works without nonces.
- Supabase REST/Auth/Functions: `https://<project-ref>.supabase.co` (`race.ts:133`).
- Supabase Realtime: `wss://<project-ref>.supabase.co/realtime/v1/websocket`
  (https://supabase.com/docs/guides/realtime/protocol).
- Google OAuth: a **top-level navigation** to `https://<project-ref>.supabase.co/auth/v1/authorize`
  → `accounts.google.com` → back. Top-level navigations are not governed by `connect-src`, which
  covers only `fetch`, XHR, `WebSocket`, `EventSource`, `sendBeacon`, `<a ping>`
  (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src),
  so the redirect flow needs no Google entry. (Only Google Identity Services / One Tap would need
  `script-src`/`frame-src https://accounts.google.com`.)

**`connect-src` and WebSockets.** `'self'` does not reliably cover `ws:`/`wss:` across browsers,
so list the `wss://` host explicitly. (MDN connect-src, above)

**`style-src`.** Without `'unsafe-inline'` CSP blocks `<style>` elements, `style="…"` attributes in
markup, `setAttribute('style', …)` and `style.cssText`, but **not** per-property assignment on
`element.style` (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src).
React applies the `style` prop through per-property CSSOM writes, so our ~35 `style=` props in
TSX should survive `style-src 'self'` — verify with Report-Only first.

**Rollout.** Vercel: start with `Content-Security-Policy-Report-Only`, avoid `unsafe-inline` /
`unsafe-eval`, prefer specific hosts over `*`
(https://vercel.com/docs/cdn-security/security-headers).

**HSTS.** Vercel already sends `Strict-Transport-Security: max-age=63072000; includeSubDomains;
preload;` on `*.vercel.app` (which is preloaded) and `max-age=63072000;` on custom domains, and
redirects HTTP→HTTPS with 308; the header can be overridden with custom headers. Note: "The WSS
protocol doesn't support redirects." (https://vercel.com/docs/cdn-security/encryption) So for us
HSTS is effectively done; add `includeSubDomains; preload` only if we own a custom apex and want
preloading (`preload` needs `max-age ≥ 31536000` + `includeSubDomains`,
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security).

**`vercel.json` syntax.** `headers: [{ source, headers: [{ key, value }], has?, missing? }]`;
`source` is a path pattern without the query string
(https://vercel.com/docs/project-configuration/vercel-json). Proposed addition to our
`vercel.json` (keep the existing two cache entries):

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<project-ref>.supabase.co wss://<project-ref>.supabase.co; worker-src 'self'; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
  ]
}
```

Swap `-Report-Only` for the enforcing header once the browser console shows no violations
(local `vite preview`, then a preview deployment, then prod). With a custom auth domain, replace
both Supabase hosts. If Turnstile CAPTCHA is added (§5), it needs
`script-src`/`frame-src https://challenges.cloudflare.com`. If the hackathon jury embeds the app in
an iframe, relax `frame-ancestors`.

Edge Function CORS: today `Access-Control-Allow-Origin: *` (`_shared/cors.ts:7`). Since calls
need a valid JWT this is not an auth hole; narrowing to `https://<prod-domain>` plus localhost is
optional hardening (previews would then need a pattern check in code).

## 8. Security and Performance Advisors

Advisors are deterministic SQL lints run against the live schema; the same checks back Studio
(Advisors → Security / Performance), the CLI, the Management API (`GET /v1/security-advisors`,
`GET /v1/performance-advisors`) and MCP `get_advisors`.
(https://supabase.com/docs/guides/observability/advisors,
https://supabase.com/docs/guides/database/database-advisors) Lint catalogue (code, level):

| Lint | Level | Checks |
|---|---|---|
| 0001 unindexed_foreign_keys | INFO | FK columns without an index |
| 0002 auth_users_exposed | ERROR | view exposes `auth.users` to the API |
| 0003 auth_rls_initplan | WARN | policy re-evaluates `auth.uid()`/`auth.jwt()` per row (the `(select …)` fix) |
| 0004 no_primary_key | INFO | table without PK |
| 0005 unused_index | INFO | index never used |
| 0006 multiple_permissive_policies | WARN | several permissive policies for one role/action |
| 0007 policy_exists_rls_disabled | INFO | policies but RLS off |
| 0008 rls_enabled_no_policy | INFO | RLS on, no policy |
| 0009 duplicate_index | WARN | identical indexes |
| 0010 security_definer_view | ERROR | view bypasses RLS |
| 0011 function_search_path_mutable | WARN | function without fixed `search_path` |
| 0012 auth_allow_anonymous_sign_ins | INFO | anonymous users share `authenticated`; policies may admit them |
| 0013 rls_disabled_in_public | ERROR | public table without RLS |
| 0014 extension_in_public | WARN | extension in `public` |
| 0015 rls_references_user_metadata | ERROR | policy trusts `user_metadata` |
| 0016 materialized_view_in_api / 0017 foreign_table_in_api | WARN | bypass RLS |
| 0018 unsupported_reg_types | WARN | blocks `pg_upgrade` |
| 0019 insecure_queue_exposed_in_api | ERROR | queue without access control |
| 0020 table_bloat | WARN | dead tuples |
| 0021 fkey_to_auth_unique | ERROR | FK to an auth unique constraint |
| 0022 extension_versions_outdated | WARN | extension needs update |
| 0023 sensitive_columns_exposed | ERROR | password/SSN/card-like columns exposed |
| 0024 permissive_rls_policy | WARN | always-true policy condition |
| 0025 public_bucket_allows_listing | WARN | storage listing |
| 0026 / 0027 pg_graphql_{anon,authenticated}_table_exposed | WARN | GraphQL introspection exposure |
| 0028 anon_security_definer_function_executable | WARN | `security definer` function callable with the anon key |
| 0029 authenticated_security_definer_function_executable | WARN | … callable by any signed-in user |
| 0030 autovacuum_disabled | INFO | autovacuum off |

Source for the list: https://supabase.com/docs/guides/database/database-advisors (lint SQL lives in
https://github.com/supabase/splinter).

**CLI.** `supabase db advisors [--linked | --local | --db-url <url>] [--type all|security|performance]
[--level info|warn|error] [--fail-on none|info|warn|error] [--output-format json]` — from
`supabase db advisors --help` on the installed CLI v2.116.0 (the docs page lists `--type`,
`--linked`, `--local`; https://supabase.com/docs/guides/observability/advisors). CI gate example:
`supabase db advisors --local --type all --fail-on error` after `supabase db reset`. (The older
`supabase db lint` is a plpgsql_check linter, not the advisors.
https://supabase.com/docs/reference/cli/supabase-db-lint)

**Expected findings on our schema (not yet run):** 0003 on the five owner policies
(`core.sql:39,42,106,132,155`); 0029 (and 0028 where `anon` still has EXECUTE) on every
`security definer` RPC in `public` — expected by design, but each must check `auth.uid()` itself
and we should `revoke execute … from anon` on all except `leaderboard`; 0012 because anonymous
sign-ins are on; 0024 on `lb_global_select`/`lb_weekly_select` `using (true)`
(`races.sql:326-327`); possibly 0001 on FK columns such as `race_rooms.text_id`
(`races.sql:90`) and `race_rooms.host_id` (`race_flow.sql:48`). Functions already pin
`search_path = ''`, so 0011 should be clean.

## Implications for our architecture

1. **Keep anonymous-first; upgrade in place.** `linkIdentity` preserves the user id, so every
   table keyed on `auth.uid()` survives the Google upgrade unchanged. Turn on *manual linking* and
   Google in the dashboard and in `config.toml` (`enable_manual_linking = true`,
   `[auth.external.google]`).
2. **Switch the client to `flowType: 'pkce'`** and add one "auth return" handler that reads
   `error_code` from the URL, cleans it with `history.replaceState`, and routes
   `identity_already_exists` to the merge flow.
3. **Merge = our code.** Build a `merge-account` Edge Function (service role) that requires proof
   of both identities (current JWT + old anonymous JWT / signed ticket), moves rows with
   conflict rules per table, then deletes the anonymous user. Design per-table merge rules now
   (`progress` "best of", `attempts` re-key, leaderboard rows recomputed from `race_results`).
4. **`delete-account` Edge Function** using `auth.admin.deleteUser`; cascade already covers all
   tables. Decide on owned groups (transfer vs delete). Optional `pg_cron` purge of anonymous users
   older than 30 days.
5. **RLS hardening migration:** `(select auth.uid())` + `to authenticated` on owner policies;
   `revoke execute … from anon` on non-public RPCs; restrictive `is_anonymous` policies (or checks
   inside RPCs) for anything gated behind Google (e.g. public boards, groups).
6. **Rate limits:** raise *anonymous sign-ins per hour* above 30 before the jury demo (shared
   NAT); add a per-user window check inside `submit-attempt`/`finish-race`; Upstash only if IP
   limiting is needed. Optional Turnstile.
7. **Headers:** add CSP (Report-Only first), `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
   `frame-ancestors 'none'` via `vercel.json`; HSTS is already sent by Vercel.
8. **Advisors in CI:** `supabase db advisors --local --fail-on error` after migrations.
9. **Redirect allow list** on the hosted project: `https://<prod-domain>/**`,
   `https://*-<team-slug>.vercel.app/**`, `http://localhost:5173/**`, `http://localhost:4173/**`;
   Site URL = `https://<prod-domain>`.

## Google OAuth checklist

Placeholders: `<project-ref>` (Supabase), `<prod-domain>` (Vercel production domain),
`<team-slug>` (Vercel team/account slug), `<support-email>`.

1. Google Cloud console → create or pick a project (a dedicated one is cleanest).
2. Google Auth Platform → **Branding**: app name `Typing-Race`, user support email
   `<support-email>`, developer contact email; **skip the logo** for now (a logo can trigger brand
   verification); app home page `https://<prod-domain>`; authorized domain: `<prod-domain>`'s
   registrable domain (and `supabase.co` only if Google asks for the redirect host's domain).
3. **Audience**: User type **External**. Leave in *Testing* while developing and add test
   accounts (max 100, consent expires after 7 days); press **Publish app → In production** before
   the demo.
4. **Data Access**: add scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   Nothing else.
5. **Clients → Create client → Web application**, name `typing-race-supabase`.
   - Authorized JavaScript origins: `https://<prod-domain>`, `http://localhost:5173`
     (remove localhost later if you like).
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` and, for the
     local stack, `http://127.0.0.1:54321/auth/v1/callback`.
   - Copy the Client ID and Client Secret (store the secret in a password manager, never in git).
6. Supabase Dashboard → Authentication → **Sign In / Providers → Google**: enable, paste Client ID
   and Secret, save. Confirm the callback URL shown there matches step 5.
7. Supabase Dashboard → Authentication → settings: **Allow anonymous sign-ins** on, **Allow manual
   linking** on.
8. Supabase Dashboard → Authentication → **URL Configuration**: Site URL `https://<prod-domain>`;
   Redirect URLs `https://<prod-domain>/**`, `https://*-<team-slug>.vercel.app/**`,
   `http://localhost:5173/**`, `http://localhost:4173/**`.
9. Supabase Dashboard → Authentication → **Rate Limits**: raise anonymous sign-ins per hour (e.g.
   to a few hundred) for the demo.
10. Local: put `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=<secret>` in an untracked env file and
    add `[auth.external.google] enabled = true, client_id = "<client-id>",
    secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"` plus
    `enable_manual_linking = true` to `supabase/config.toml`.
11. Test: anonymous session on device A → "Save with Google" → returns signed in, same user id,
    `is_anonymous` false. Device B anonymous → same Google account → expect
    `identity_already_exists` on return → merge flow.
12. Optional later: custom auth domain (consent screen then shows your domain instead of
    `<project-ref>.supabase.co`), then add its `/auth/v1/callback` to step 5.
