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

_TBD_

## 4. RLS patterns

_TBD_

## 5. Rate limiting

_TBD_

## 6. "Delete my data"

_TBD_

## 7. CSP and HSTS on Vercel

_TBD_

## 8. Security and Performance Advisors

_TBD_

## Implications for our architecture

_TBD_

## Google OAuth checklist

_TBD_
