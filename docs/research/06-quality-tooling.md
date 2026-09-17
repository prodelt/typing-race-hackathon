# 06 Research: Quality tooling for real E2E and quality gates

Status: complete
Date: 2026-09-17 (verified against tool versions current on this date)
Ticket: `.scratch/typing-race-hackathon/issues/06-quality-tooling-research.md`
Scope: what makes the agreed Definition of Done (Vitest + fast-check unit, Playwright E2E on the
production build in 3 engines, real local Supabase, axe + screenshots, CI on every PR) real, fast
and non-flaky. Internal hackathon: no SLA / ToS / compliance analysis.

## 1. Summary

1. **The keyboard question decides an app-architecture question, not just a test question.**
   Playwright 1.63 is locked to a US QWERTY table: `keyboard.press('й')` throws, and `type('привіт')`
   degrades to `insertText`, so **no `keydown`/`keyup` is emitted for Ukrainian characters in any
   engine** (verified in Chromium 153, Firefox 155, WebKit 26.6 today). With nothing focused, Chromium
   and WebKit emit *nothing at all*. Therefore the typing engine must take characters from
   `beforeinput`/`input` + `compositionend` on a **focused hidden `<textarea>`**, using `keydown` only
   for control keys and `event.code` for finger hints. That is also the only correct design for real
   IME, dead-key and non-US-layout users, which TZ §4.2 demands.
2. **Firefox emits every non-US character as an IME composition** (`insertCompositionText`,
   `isComposing: true`), and ignores `preventDefault()` on that `beforeinput`. The input engine must
   commit on `compositionend` and clear the sink itself.
3. **Full keyboard hazards (physical ЙЦУКЕН `code`, `key:'Dead'`, real IME composition) are
   reproducible in Chromium via CDP** — `Input.dispatchKeyEvent` with `key:'й', code:'KeyQ'` produced a
   genuine trusted keydown + text insertion, `Input.imeSetComposition` a full composition sequence.
   No equivalent exists for Firefox/WebKit, so those specs are Chromium-only; the logic under test is
   engine-independent. Alt / Ctrl+Alt are faithful everywhere (keydown with `altKey`, no text) — the
   §4.2 "Alt must not break the session" case is cross-engine testable.
4. **Everything else in the DoD is available and cheap**: Playwright `webServer` against
   `vite preview` (production build), setup-project `storageState` auth, multi-context races, Clock
   API for countdowns (but it fakes `rAF`/`performance`, so keep it away from latency specs), blob
   reports + `merge-reports` for sharding, `@axe-core/playwright` 4.13, `toHaveScreenshot` with Linux
   baselines built in `mcr.microsoft.com/playwright:v1.63.0-noble`.
5. **Supabase local is the real backend for tests**: `supabase start` (CLI 2.117.0) runs Postgres,
   GoTrue, Realtime and **Mailpit** (`:54324`, REST API `/api/v1/messages`), so auth e-mails are
   captured locally and **Resend is never called**; most tests skip mail entirely by creating
   confirmed users with `auth.admin.createUser({ email_confirm: true })`. In CI:
   `supabase/setup-cli@v3` + `supabase start -x …` on the free public-repo runners.
6. **Preview verification works as specified**: `on: deployment_status` (workflow file must already be
   on `main`) plus Vercel's Protection Bypass for Automation
   (`x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie: true`), available on Hobby.
7. **Latency in tests needs care**: Event Timing only reports interactions ≳16 ms, and default
   headless Chromium does not paint on schedule (measured 335–935 ms per "frame"); with
   `--disable-frame-rate-limit` and the backgrounding flags the same probe reports 1–7 ms. Keep a
   Chromium-only `perf` project as a tripwire, not a benchmark.
8. **Cost of the gates is low**: public-repo Actions minutes are free (20 concurrent jobs on Free),
   gitleaks-action needs no licence for a personal-account repo, GitHub secret scanning is free on
   public repos.

## 2. Findings per tool with sources

### 2.1 Playwright keyboard fidelity (the decisive question)

**Version.** Latest stable is **Playwright 1.63.0**, published 2026-09-04 (npm `dist-tags.latest`);
`next` is `1.64.0-alpha-2026-09-17`. 1.63 bundles Chromium 153, Firefox 155, WebKit 26.6
(playwright.dev release notes). Everything below was verified against 1.63.0.

**How the key pipeline works** (source, v1.63.0 `packages/playwright-core/src/server/input.ts`):

```ts
private _keyDescriptionForString(str: string): KeyDescription {
  const keyString = resolveSmartModifierString(str);
  let description = usKeyboardLayout.get(keyString);
  if (!description)
    throw new NonRecoverableDOMError(`Unknown key: "${keyString}"`);
  const shift = this._pressedModifiers.has('Shift');
  description = shift && description.shifted ? description.shifted : description;
  // if any modifiers besides shift are pressed, no text should be sent
  if (this._pressedModifiers.size > 1 || (!this._pressedModifiers.has('Shift') && this._pressedModifiers.size === 1))
    return { ...description, text: '' };
  return description;
}

async type(progress, text, options) {
  for (const char of text) {
    if (usKeyboardLayout.has(char)) await this.press(progress, char, { delay });
    else { if (delay) await progress.wait(delay); await this.insertText(progress, char); }
  }
}
```

Consequences, all confirmed experimentally below:

- Playwright is hard-wired to a **US QWERTY layout table** (`usKeyboardLayout`). There is no API for a
  different physical layout. Primary sources: feature request
  [#3989 "Adding support to custom keyboard layout"](https://github.com/microsoft/playwright/issues/3989)
  (open since 2020, `P3-collecting-feedback`) and
  [#7396 "Russian Keyboard Layout"](https://github.com/microsoft/playwright/issues/7396)
  (closed as not planned; maintainers: use `fill()` / `pressSequentially()`, "this will work with any
  keyboard layout").
- `press('й')`, `press('Dead')`, `press('Unidentified')` **throw** `Unknown key: "..."`.
- `type('йі')` silently degrades to `insertText` per character: **no `keydown`/`keyup` at all**.
- Any modifier other than Shift blanks `text`, so `Alt+KeyQ` produces keydown/keyup with
  `altKey: true` and **no character insertion** — exactly the TZ 4.2 "accidental Alt must not break
  the session" case, testable in all three engines.

**Experiment (run 2026-09-17, throwaway, outside the repo).** In the session scratchpad
`.../scratchpad/pwlab/`: `npm i -D @playwright/test@1.63.0`, scripts `kbd.mjs` and `kbd2.mjs`,
headless chromium/firefox/webkit, a page with a hidden `<textarea>` plus a `contenteditable`,
capturing `keydown/keypress/keyup/beforeinput/input/composition*` with `key`, `code`, `data`,
`inputType`, `isComposing`. Raw output: `kbd-out.json`, `kbd2-out.json`.

Results that drive our design:

1. **Latin via `type()`/`press()`** — identical, complete sequence in all three engines:
   `keydown(key:"a", code:"KeyA") -> keypress -> beforeinput(insertText,"a") -> input -> keyup`.
2. **Cyrillic via `type('йі')`**:
   - Chromium and WebKit: `beforeinput(inputType:"insertText", data:"й") -> input`, **no key events**.
   - Firefox: `insertText` is implemented as a **composition**: `compositionstart ->
     compositionupdate -> beforeinput(inputType:"insertCompositionText", isComposing:true) ->
     compositionend -> input(inputType:"insertCompositionText", isComposing:false)`. Every Ukrainian
     character therefore looks like a committed IME composition on Firefox.
3. **With nothing focused (body), Cyrillic produces no events at all** in Chromium and WebKit
   (Firefox emits only an empty `compositionstart`/`compositionend` pair). A `window`-level `keydown`
   listener sees nothing. This is the most important architectural constraint in this document.
4. **`contenteditable`** behaves like `<textarea>` for all of the above.
5. **Backspace** is a real key everywhere: `keydown(Backspace) -> beforeinput(deleteContentBackward)
   -> input -> keyup`. `Shift+KeyA` yields `key:"A"`, `code:"KeyA"`.
6. **`preventDefault()` on `beforeinput`** cancels insertion in Chromium and WebKit but **not in
   Firefox** (the value still changed), because there it is `insertCompositionText`. Do not rely on
   it — clear the sink element after each `input` instead.
7. **CDP (Chromium only)** delivers the fidelity the public API cannot:
   - `Input.dispatchKeyEvent { type:'keyDown', key:'й', code:'KeyQ', windowsVirtualKeyCode:81, text:'й' }`
     produced a real trusted `keydown(key:"й", code:"KeyQ") -> keypress -> beforeinput(insertText,"й")
     -> input -> keyup`. **This is how we simulate a physical ЙЦУКЕН keyboard.**
   - `Input.dispatchKeyEvent { key:'Dead', code:'Quote' }` produced `keydown(key:"Dead")` / `keyup`
     with no text — the TZ 4.2 dead-key case.
   - `Input.imeSetComposition { text:'прив' }` followed by `Input.insertText` produced the full real
     IME sequence `compositionstart -> compositionupdate -> beforeinput(insertCompositionText,
     isComposing:true) -> input -> compositionend`.
   Firefox (juggler) and WebKit expose no equivalent through Playwright: injecting `key:"й"` with
   `code:"KeyQ"`, a dead key, or a composition there is **UNVERIFIED / no known way**.
8. **Throughput** (46 characters, no delay, warm browser): Chromium 29 ms Cyrillic / 48 ms Latin,
   Firefox 62 / 216 ms, WebKit 96 / 172 ms; one `insertText` of the whole string is ~1 ms. Typing a
   realistic exercise is not a performance problem, even with a per-character delay.

**What this means for the app, not just for the tests**

- The typing engine must read the *character* from `beforeinput`/`input` (`event.data`) plus
  `compositionend` on a **focused hidden `<textarea>`** — never from `keydown` + `event.key`. That is
  simultaneously (a) the only thing testable cross-engine and (b) the only thing correct for real
  users with IME, dead keys, mobile keyboards and non-US layouts, which TZ 4.2 requires.
- `keydown` remains the source for **control keys** (Backspace, Enter, Tab, Escape) and for
  `event.code` (physical key -> finger hint / highlight, and "does your OS layout match the exercise?"
  detection). Control keys are faithful in all three engines.
- Input-engine rule: **ignore `beforeinput`/`input` while `isComposing === true`, commit on
  `compositionend`** (its `data`); accept only `inputType` of `insertText` / `insertCompositionText` /
  `deleteContentBackward`. With that rule one test passes on Firefox (composition path) and on
  Chromium/WebKit (plain path).
- Never let the sink `<textarea>` accumulate: set `value = ''` after each handled `input` (Firefox
  ignores `preventDefault` here).

**How each case gets tested**

| Case | Technique | Engines |
| --- | --- | --- |
| Ukrainian / English characters | `locator.pressSequentially('привіт', { delay })` | all 3 |
| Backspace, Enter, Esc, Tab, Shift | `keyboard.press(...)` | all 3 |
| Accidental Alt / AltGr | `press('Alt+KeyQ')`, `press('Control+Alt+KeyQ')`, bare `press('Alt')` | all 3 |
| Physical ЙЦУКЕН key (`key:'й'`, `code:'KeyQ'`) | CDP `Input.dispatchKeyEvent` | Chromium |
| Dead key (`key:'Dead'`) | CDP `Input.dispatchKeyEvent` | Chromium |
| IME composition | CDP `Input.imeSetComposition` + `Input.insertText` | Chromium |
| Wrong OS layout (Latin typed into a Ukrainian exercise) | `pressSequentially('privit')`, assert warning | all 3 |

Chromium-only cases live in a tagged spec guarded by `test.skip(browserName !== 'chromium')`: they
exercise engine-independent app logic, while the cross-engine specs cover user-visible flows.

Sources: [keyboard API](https://playwright.dev/docs/api/class-keyboard) ("For characters that are not
on a US keyboard, only an `input` event will be sent"; "Modifier keys DO NOT effect `keyboard.type`"),
[input.ts v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/input.ts),
issues [#3989](https://github.com/microsoft/playwright/issues/3989),
[#7396](https://github.com/microsoft/playwright/issues/7396),
[#6267](https://github.com/microsoft/playwright/issues/6267),
[#24107](https://github.com/microsoft/playwright/issues/24107), and the experiment above.

### 2.2 Playwright: multi-context races, auth, clock, sharding, retries, traces

**Several players in one test.** A race with N players = N `browser.newContext()` (each has its own
cookies/localStorage, hence its own Supabase session), one page each. The auth guide shows exactly
this shape: `const adminContext = await browser.newContext({ storageState: 'playwright/.auth/admin.json' })`
next to a second context. Type in both with `await Promise.all([...])` and assert with web-first
assertions (`expect(locator).toHaveText(...)`), which auto-retry — never `waitForTimeout`. Three
contexts in one worker is cheap; contexts share one browser process.

**Auth.** Recommended pattern (playwright.dev/docs/auth): a `setup` project whose tests log in and
call `page.context().storageState({ path: 'playwright/.auth/user.json' })`, and real projects
declaring `dependencies: ['setup']` + `use: { storageState: … }`. For tests that mutate shared state,
authenticate **per worker** keyed on `test.info().parallelIndex`. The fastest variant, and the one to
use here: log in through the API (`request.storageState({ path })`) instead of the UI, after creating
the user with the Supabase admin API. Caveats from the doc: `playwright/.auth` must be gitignored;
**sessionStorage is not captured** (supabase-js stores the session in localStorage by default, which
*is* captured); stored sessions expire — local `auth.jwt_expiry` defaults to 3600 s, so regenerate
storage state per run (the setup project does that automatically).

**Clock.** `clock.setFixedTime`, `install`, `pauseAt`, `fastForward`, `runFor`, `resume`,
`setSystemTime`. It fakes `Date`, `setTimeout/Interval`, `requestAnimationFrame`,
`requestIdleCallback`, `performance` and `Event.timeStamp`, and "if you call `install` … the call
MUST occur before any other clock related calls". Implications for us:
- Use `setFixedTime` for screenshots that contain dates/times and for "session finished at" text.
- Use `install` + `fastForward` for idle timeouts and pre-race countdowns **only in tests that do not
  assert typing latency or animation**, because `install` also fakes `rAF` and `performance.now()` —
  the very clocks the typing engine and the latency probe use.
- A countdown driven by a Supabase **server** timestamp cannot be fast-forwarded from the client; keep
  a seam (server-provided `starts_at` injected via test hook or a short countdown in test config).

**webServer against the production build.** `webServer: { command: 'npm run preview', url,
reuseExistingServer: !process.env.CI, timeout }` (array form if we need more than one). This is how
the DoD requirement "run against the production build, not the dev server" is satisfied: `vite build`
then `vite preview`. `reuseExistingServer: !process.env.CI` keeps local iteration fast and forces a
fresh server in CI.

**Determinism knobs on the context** (`browser.newContext`): `viewport`, `deviceScaleFactor`,
`locale`, `timezoneId`, `colorScheme`, `forcedColors`, and `reducedMotion` — *"Emulates
'prefers-reduced-motion' media feature, supported values are 'reduce', 'no-preference'"*. Pin all of
them in `use: {}` for the screenshot project.

**Sharding, retries, traces.** `npx playwright test --shard=x/y`; in CI use
`reporter: process.env.CI ? 'blob' : 'html'` and merge with
`npx playwright merge-reports --reporter html ./all-blob-reports` in a dependent job. `fullyParallel:
true` makes shards balanced (splitting per test rather than per file). On retry Playwright *"discards
the entire worker process and browser"*, so retries are clean; `testInfo.retry` is available for
per-retry cleanup, and results are classified passed/flaky/failed. Settings we want:
`retries: process.env.CI ? 1 : 0` (1 makes real infrastructure blips survivable while still reporting
"flaky"), `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.

Sources: [auth](https://playwright.dev/docs/auth), [clock](https://playwright.dev/docs/clock),
[webServer](https://playwright.dev/docs/test-webserver),
[newContext](https://playwright.dev/docs/api/class-browser#browser-new-context),
[sharding](https://playwright.dev/docs/test-sharding), [retries](https://playwright.dev/docs/test-retries).

### 2.3 Supabase in tests: local stack, seeding, users, e-mail capture

**What `supabase start` gives you.** The full stack in Docker: Postgres (`54322`), API gateway/Kong
(`54321`), Studio (`54323`) and "a local SMTP server". The container list in `supabase start -x`
names them explicitly: `gotrue, realtime, storage-api, imgproxy, kong, mailpit, postgrest,
postgres-meta, studio, edge-runtime, logflare, vector, supavisor` — note **`mailpit`**: the local mail
catcher is Mailpit (it replaced Inbucket; CLI ≥ 2.108.0 renamed the config section `[inbucket]` to
`[local_smtp]`, the docs still show `[inbucket]`). Web UI and REST API on **54324**, SMTP on 54325.
Current CLI: **2.117.0** (2026-09-07).

**Config keys that matter for tests** (`supabase/config.toml`):
`[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]` — seeds run on `supabase start` and on
`supabase db reset`; `[auth] enable_signup`, `jwt_expiry` (default 3600), `site_url`,
`additional_redirect_urls`; `[auth.email] enable_confirmations` (default false locally);
`[inbucket]/[local_smtp] enabled, port = 54324, smtp_port = 54325, pop3_port = 54326`.

**Reset and seed.** `supabase db reset` re-applies all migrations from `supabase/migrations/` and then
the seed files — that is the between-suite reset primitive. It is seconds-fast on a local Postgres and
far more reliable than truncating tables by hand. Practical layout: `seed.sql` holds only
*reference* data (curriculum, dictionaries metadata); each spec creates its own users/rooms with
unique ids so specs stay parallel-safe; a global setup runs `supabase db reset` once per E2E run.

**Test users without any e-mail.** `supabase.auth.admin.createUser({ email, password, email_confirm:
true })` with the **service_role** key (server-side only) creates a ready-to-use confirmed user in one
call. Do this in the Playwright `setup` project / a fixture, then log in via the API and save
`storageState`. No Resend, no inbox, no waiting.

**One test that does exercise the real e-mail flow.** Flip `[auth.email] enable_confirmations = true`
(a dedicated local config or a `supabase/config.toml` profile), sign up through the UI, then read the
message from Mailpit's REST API: `GET /api/v1/messages` (list), `GET /api/v1/message/{ID}` (body,
links), `GET /api/v1/search`, `DELETE /api/v1/messages` (clear the box before the test). Extract the
confirmation link from the body and `page.goto` it. This proves the whole signup→confirm→sign-in path
while **never touching Resend** — Resend only differs in the SMTP credentials of the hosted project.

**In GitHub Actions.** `supabase/setup-cli@v3` (input `version`, default `latest`), then
`supabase start`. Ubuntu runners ship Docker, so no extra setup (the action notes extra setup is only
needed on Windows/macOS runners). Cut startup by excluding what we do not use:
`supabase start -x studio,imgproxy,logflare,vector,edge-runtime,supavisor` (keep `gotrue`, `realtime`,
`postgrest`, `kong`, `mailpit`). Image pulls dominate the cold-start cost; exact seconds on a
`ubuntu-latest` runner are **UNVERIFIED** here (no Docker daemon running on this machine today) —
budget 1.5–3 min and measure on the first CI run. Read the local credentials in CI with
`supabase status -o env` instead of hardcoding keys.

`supabase test db` (pgTAP) + `supabase db lint` are available if we want RLS assertions at the SQL
level; the pragmatic minimum is a handful of pgTAP tests proving "user A cannot read user B's
progress", which is much cheaper than driving RLS violations through the UI.

Sources: [local dev getting started](https://supabase.com/docs/guides/local-development/cli/getting-started),
[CLI config](https://supabase.com/docs/guides/local-development/cli/config),
[supabase start reference](https://supabase.com/docs/reference/cli/supabase-start),
[testing and linting](https://supabase.com/docs/guides/local-development/cli/testing-and-linting),
[auth.admin.createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[setup-cli](https://github.com/supabase/setup-cli),
[Mailpit](https://github.com/axllent/mailpit) + [API v1 swagger](https://raw.githubusercontent.com/axllent/mailpit/master/server/ui/api/v1/swagger.json),
[cli#5222 Inbucket→Mailpit rename](https://github.com/supabase/cli/issues/5222).

### 2.4 Vercel previews: running E2E against the deployed preview

Two pieces are needed and both are documented.

1. **Trigger.** GitHub's `deployment_status` event fires when a third party (Vercel) reports a
   deployment status; the payload carries `deployment_status.environment_url` and `state`
   (filter `== 'success'`), `GITHUB_SHA` is the deployed commit. Two constraints: *"This event will
   only trigger a workflow run if the workflow file exists on the default branch"*, and a status of
   `inactive` triggers nothing. So the preview-E2E workflow must be merged to `main` before it can
   ever run.
2. **Protection bypass.** Preview deployments sit behind Deployment Protection. Vercel's *Protection
   Bypass for Automation* issues a secret, exposed to the deployment as
   `VERCEL_AUTOMATION_BYPASS_SECRET`, and Vercel's own docs give the Playwright snippet:

   ```ts
   use: {
     extraHTTPHeaders: {
       'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
       'x-vercel-set-bypass-cookie': 'true',   // 'samesitenone' inside an iframe
     },
   }
   ```
   `x-vercel-set-bypass-cookie: true` is what makes **in-browser** testing work (the bypass becomes a
   cookie via a `Set-Cookie` redirect, so sub-requests and client-side navigations pass too). The
   feature is available on all plans, Hobby included; the secret must be stored as a GitHub secret and
   re-copied if regenerated (regenerating invalidates previous deployments until redeploy).

Practical scoping: the preview run should be a **smoke subset** (`--grep @smoke`), Chromium only, with
its own test accounts against the one hosted Supabase project — full three-engine coverage and all
destructive/multiplayer specs stay on the local stack in the PR job.

Sources: [events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows),
[Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

### 2.5 Accessibility: @axe-core/playwright

`@axe-core/playwright` 4.13.0 (2026-08-11). Usage is one line inside an existing test:
`const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()`,
then `expect(results.violations).toEqual([])`. `.exclude(selector)` and `.disableRules([...])` park
known issues; `testInfo.attach('accessibility-scan-results', { body: JSON.stringify(results), contentType: 'application/json' })`
puts the full report in the HTML report; a fixture shares one configured builder across specs.

Pragmatics: scan the handful of distinct screens (login, curriculum, training, results, lobby, race),
not every test — each `analyze()` injects and runs axe (~0.5–2 s). The training screen must be scanned
**while typing is in progress** too, since that is when live regions and the caret matter.

Source: [accessibility testing](https://playwright.dev/docs/accessibility-testing).

### 2.6 Visual regression

**Built-in `toHaveScreenshot` is the right choice here.** Snapshot files are stored next to the spec
in `<spec>-snapshots/` and the name carries browser + platform (`…-chromium-darwin.png`) because
*"Screenshots differ between browsers and platforms due to different rendering, fonts and more"*, and
the doc warns: *"Browser rendering can vary based on the host OS, version, settings, hardware, power
source (battery vs. power adapter), headless mode … For consistent screenshots, run tests in the same
environment where the baseline screenshots were generated."*

Consequence for a Windows dev box + Linux CI: **never commit baselines generated on Windows.**
Generate and update them inside the official image `mcr.microsoft.com/playwright:v1.63.0-noble`
(pin the tag to the exact Playwright version; run with `--ipc=host`, otherwise "Chromium can run out
of memory and crash"), which is the same image/runner family CI uses. A `npm run snapshots:update`
script wrapping `docker run` keeps this one command for the whole team.

Determinism checklist for our app: `animations: 'disabled'` and `caret: 'hide'` on the assertion, the
app-level motion flag from research 04 forced off, `reducedMotion: 'reduce'` in the context, fixed
`viewport` + `deviceScaleFactor`, fixed `locale`/`timezoneId`, `clock.setFixedTime` for any visible
clock, **self-hosted font files** (a Google Fonts request at screenshot time is both a network
dependency and a rendering difference), `stylePath` to neutralise anything dynamic, and a small
`maxDiffPixelRatio` (e.g. 0.01) rather than pixel-exact.

Hosted services (Argos, Percy, Chromatic) are not needed for a hackathon and add an integration to
maintain; Argos advertises a free open-source tier but the current terms are **UNVERIFIED** here.

Sources: [test snapshots](https://playwright.dev/docs/test-snapshots), [Docker](https://playwright.dev/docs/docker).

### 2.7 Vitest browser mode and fast-check

**Vitest 5.0.1** (2026-09-15) is current; browser mode runs real browsers through a `playwright`
provider (recommended for parallelism), `webdriverio`, or `preview`, with headless support, and is
positioned for component/DOM tests rather than whole flows.

Where it earns its place in this project: **jsdom/happy-dom cannot reproduce `beforeinput`,
`compositionstart/end` or `inputType` faithfully**, and §2.1 shows those events *are* our input
contract. So:
- pure domain logic (SPM/CPM/WPM, accuracy, error counting, word filtering, n-gram selection,
  dictionary normalisation) → plain Vitest in Node, no DOM at all;
- the input-sink component (hidden textarea → character stream, composition handling, Backspace,
  Alt-ignore) → a small Vitest **browser-mode** suite on chromium+firefox+webkit, which is far faster
  to iterate than full E2E and catches the Firefox composition path;
- everything user-visible → Playwright E2E.

**fast-check 4.10.1** (2026-09-15) needs no plugin: `fc.assert(fc.property(arb, pred))` inside a
Vitest `test`. High-value properties given TZ §8: corrected errors still counted
(`errors(keystrokes) >= errors(keystrokes without backspaces)`), stage-2 exercises only contain
unlocked characters, every supported key maps to exactly one finger, `і/ї/є/ґ` survive normalisation
round-trips, dictionary processing is idempotent (run twice → identical output), and SPM/accuracy
formulas hold on generated keystroke streams. Failures are reproducible via the printed seed/path;
pin `numRuns` (e.g. 200) so CI time stays bounded.

Sources: [Vitest browser mode](https://vitest.dev/guide/browser/), npm registry for versions.

### 2.8 Measuring keystroke-to-paint latency inside tests

Verified experimentally today (`…/scratchpad/pwlab/latency.mjs`, same three browsers):

- `'event'` is in `PerformanceObserver.supportedEntryTypes` in **all three** engines, but with
  `durationThreshold: 0` Chromium and Firefox reported **zero** entries for normal typing and WebKit
  reported a single `keyup` of 16 ms. Event Timing only surfaces *slow* interactions (the spec's
  minimum threshold is 16 ms). That makes it a good **assertion of absence** ("no interaction entry
  longer than N ms"), not a measurement tool.
- A double-`requestAnimationFrame` probe around the `input` handler works and is engine-portable, but
  **default headless Chromium does not paint on a schedule**: samples came back as
  `[935, 890, 842, …]` ms (all callbacks flushed at the end). Re-running Chromium with
  `--disable-frame-rate-limit --disable-renderer-backgrounding --disable-backgrounding-occluded-windows
  --disable-background-timer-throttling` produced sane values `[37, 1.7, 1.4, 7.5, 1.2, …]` ms.
  Firefox gave 1–15 ms and WebKit ~14–16 ms out of the box.
- Chromium also exposes `long-animation-frame` and `longtask` entry types (seen in
  `supportedEntryTypes`), which are a cheap jank guard.

Recommendation: a separate `perf` Playwright project, **Chromium only**, with those launch args, that
types ~100 characters and asserts p95(input→second rAF) under a generous budget (e.g. 50 ms in CI) and
"no Event Timing entry > 100 ms". Treat it as a regression tripwire, not a benchmark; never assert the
16 ms design target in CI.

### 2.9 Lighthouse CI

`treosh/lighthouse-ci-action@v12` (bundles Lighthouse 12.6; `@lhci/cli` 0.15.1) takes `urls`,
`runs`, `configPath`, `budgetPath`, `uploadArtifacts`, `temporaryPublicStorage`, and supports LHCI
assertions and budgets. Run it **against the Vercel preview URL** in the `deployment_status` workflow
with `runs: 3`, assert only category scores that matter (performance, accessibility, best-practices)
and keep it non-blocking at first — shared runners are noisy and a red Lighthouse on a flaky run would
block merges for no signal.

Source: [lighthouse-ci-action](https://github.com/treosh/lighthouse-ci-action).

### 2.10 Secret scanning: gitleaks

gitleaks v8 (`gitleaks git|dir|stdin`; `detect`/`protect` deprecated since 8.19.0). Two layers:
- **pre-commit** via the official hook (`repo: https://github.com/gitleaks/gitleaks`, pinned `rev`,
  `id: gitleaks`); `SKIP=gitleaks git commit` documented as the escape hatch. On Windows this needs
  Python's `pre-commit`; if we prefer to stay in the Node toolchain, husky + a `gitleaks git --staged`
  call is equivalent.
- **CI** via `gitleaks/gitleaks-action@v3`. Licensing: *"GITLEAKS_LICENSE (required for organizations,
  not required for user accounts)"* — our repo lives under the personal account `prodelt`, so **no
  license key is needed**.
- Free bonus on public repos: GitHub's own secret scanning *"runs automatically for free"*.

Sources: [gitleaks](https://github.com/gitleaks/gitleaks), [gitleaks-action](https://github.com/gitleaks/gitleaks-action),
[about secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning).

### 2.11 GitHub Actions budget for a public repo

*"GitHub Actions usage is free for self-hosted runners and for public repositories that use standard
GitHub-hosted runners."* Limits that actually bind us: **20 concurrent jobs** on the Free plan,
6 h per job, 35 days per workflow run, 256 jobs per matrix, 500 KB per workflow file. With 20
concurrent jobs, a 3-browser × 2-shard matrix (6 jobs) plus lint/typecheck/unit/build leaves room.
Add `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` so
force-pushes don't pile up runs.

Sources: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[Actions limits](https://docs.github.com/en/actions/reference/limits).

### 2.12 Windows dev specifics

- **Playwright on Windows 11 works out of the box**: all three engines were installed and driven
  headless from this machine today (`%LOCALAPPDATA%\ms-playwright\{chromium,firefox,webkit}-*`).
  No WSL needed for E2E.
- **Supabase needs Docker Desktop running** (WSL2 backend). The daemon is currently stopped, so
  `supabase start` will fail until it is started; add that to the README's "run locally" steps and
  guard the E2E script with a friendly check.
- **Screenshot baselines must not be generated on Windows** (§2.6) — use the Playwright Linux image
  via Docker Desktop.
- **Line endings are a real risk for TZ §8.7** ("checksums of the immutable raw data match the
  manifest"): git on this machine is converting LF→CRLF on checkout (observed while committing this
  file). Commit a `.gitattributes` with `* text=auto eol=lf` and mark the raw dictionaries binary
  (`dictionaries/** -text`) so checksums are stable across Windows and Linux CI.
- **Toolchain**: Node 24 + npm 11 present, bun 1.4 present, no pnpm. Use npm in CI
  (`actions/setup-node` with `cache: 'npm'`) for parity with the dev box; bun is fine locally but do
  not split the lockfile.

## 3. Keyboard / IME fidelity matrix per browser

Verified 2026-09-17 with Playwright 1.63.0 (Chromium 153 / Firefox 155 / WebKit 26.6), headless,
Windows 11 host. "Sink" = focused hidden `<textarea>`.

| Capability | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Latin char via `type()`/`pressSequentially()` → full `keydown/keypress/beforeinput/input/keyup`, correct `key`+`code` | yes | yes | yes |
| Cyrillic char via `type()` → `keydown`/`keyup` | **no** | **no** | **no** |
| Cyrillic char via `type()` → `beforeinput`+`input` with `data` | yes, `inputType: insertText` | yes, but as a **composition** (`insertCompositionText`, `isComposing: true`, wrapped in `compositionstart/end`) | yes, `inputType: insertText` |
| Cyrillic with **no focused editable** (window-level listener) | **no events at all** | only empty `compositionstart/end` | **no events at all** |
| `keyboard.press('й')` | throws `Unknown key` | throws | throws |
| `press('Dead')` / `press('Unidentified')` | throws | throws | throws |
| Backspace (`keydown` + `deleteContentBackward`) | yes | yes | yes |
| `Shift+KeyA` → `key:"A"`, `code:"KeyA"` | yes | yes | yes |
| `Alt+KeyQ` → keydown with `altKey`, **no text inserted** | yes | yes | yes |
| `Control+Alt+KeyQ` (AltGr-like) → no text inserted | yes | yes | yes |
| Bare `Alt` tap → keydown/keyup only | yes | yes | yes |
| `preventDefault()` on `beforeinput` blocks insertion | yes | **no** | yes |
| Real key event with `key:'й'` + physical `code:'KeyQ'` | yes, via CDP `Input.dispatchKeyEvent` | no known way | no known way |
| Dead key (`key:'Dead'`) | yes, via CDP | no known way | no known way |
| IME composition (`compositionstart/update/end`, `insertCompositionText`) | yes, via CDP `Input.imeSetComposition` (+ `Input.insertText` to commit) | **happens implicitly** on every non-US character | no known way |
| `PerformanceObserver` `'event'` entries for fast typing | none below ~16 ms | none below ~16 ms | occasional (one 16 ms `keyup` seen) |
| Double-`rAF` paint timing in default headless | **unusable** (frames throttled) — needs `--disable-frame-rate-limit` etc. | usable (1–15 ms) | usable (~14–16 ms) |

Reading of the matrix: **every user-visible Ukrainian/English typing scenario is testable in all three
engines** provided the app takes characters from `beforeinput`/`input`+`compositionend` on a focused
sink; the exotic keyboard hazards of TZ §4.2 (dead keys, IME, physical ЙЦУКЕН codes) are testable at
full fidelity in Chromium only, which is enough because the handling code is engine-independent.

## 4. Proposed toolchain and CI job layout

### 4.1 Toolchain (versions current on 2026-09-17)

| Layer | Choice | Version |
| --- | --- | --- |
| Unit / domain | Vitest (node environment, no DOM) | 5.0.1 |
| Property-based | fast-check | 4.10.1 |
| Input-engine component tests | Vitest browser mode, `playwright` provider, 3 engines | 5.0.1 |
| E2E | `@playwright/test`, projects per engine, run against `vite preview` | 1.63.0 |
| Accessibility | `@axe-core/playwright` inside E2E | 4.13.0 |
| Visual | Playwright `toHaveScreenshot`, baselines built in `mcr.microsoft.com/playwright:v1.63.0-noble` | — |
| Backend under test | Supabase CLI local stack (Postgres, GoTrue, Realtime, Mailpit) | 2.117.0 |
| Mail capture | Mailpit REST API on `:54324` | bundled |
| DB assertions | pgTAP via `supabase test db` (RLS only) | bundled |
| Perf tripwire | Playwright `perf` project (Chromium + anti-throttle flags) | — |
| Lighthouse | `treosh/lighthouse-ci-action@v12` against the preview URL, advisory | v12 |
| Secrets | `gitleaks/gitleaks-action@v3` + pre-commit hook + GitHub secret scanning | v8 / v3 |
| CI | GitHub Actions, standard runners (free for public repos) | — |

### 4.2 `playwright.config.ts` shape

```ts
export default defineConfig({
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'blob' : 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry', video: 'retain-on-failure', screenshot: 'only-on-failure',
    locale: 'uk-UA', timezoneId: 'Europe/Kyiv', reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { extraHTTPHeaders: {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true' } } : {}),
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },             // admin-created users + storageState
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: STATE }, dependencies: ['setup'] },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'], storageState: STATE }, dependencies: ['setup'] },
    { name: 'webkit',   use: { ...devices['Desktop Safari'],  storageState: STATE }, dependencies: ['setup'] },
    { name: 'perf', testMatch: /perf\//, use: { ...devices['Desktop Chrome'],
        launchOptions: { args: ['--disable-frame-rate-limit', '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'] } } },
  ],
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173',
               reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
```

Spec folders: `e2e/learning/`, `e2e/typing/` (incl. `keyboard-hazards.chromium.spec.ts` guarded by
`test.skip(({ browserName }) => browserName !== 'chromium')`), `e2e/race/` (multi-context),
`e2e/auth/` (incl. one Mailpit confirmation test), `e2e/a11y/`, `e2e/visual/`, `perf/`.

### 4.3 CI jobs

**`ci.yml` — `pull_request` + `push: main`**, with
`concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }`.

| Job | Steps | Blocking |
| --- | --- | --- |
| `static` | setup-node 24 (`cache: npm`), `npm ci`, `tsc --noEmit`, eslint, `vitest run` (unit + fast-check), dictionary checksum verification (TZ §8.7) + idempotency check (§8.8), `gitleaks-action@v3` | yes |
| `build` | `npm run build`, upload `dist/` artifact | yes |
| `components` | `npx playwright install --with-deps chromium firefox webkit`, `vitest run --browser` (input-engine suite) | yes |
| `e2e` | matrix `browser × shard` (3 × 2 = 6 jobs): `supabase/setup-cli@v3`, `supabase start -x studio,imgproxy,logflare,vector,edge-runtime,supavisor`, export `supabase status -o env`, `supabase db reset`, `npx playwright install --with-deps ${{ matrix.browser }}`, download `dist/`, `npx playwright test --project=${{ matrix.browser }} --shard=${{ matrix.shard }}/2`, upload blob report | yes |
| `e2e-report` | `needs: e2e`, `if: always()`, download blobs, `npx playwright merge-reports --reporter html`, upload report | no |

**`preview-e2e.yml` — `on: deployment_status`** (the file must be on `main` before it can fire):

```yaml
if: github.event.deployment_status.state == 'success' && github.event.deployment.environment != 'Production'
env:
  E2E_BASE_URL: ${{ github.event.deployment_status.environment_url }}
  VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
```
steps: `npx playwright test --project=chromium --grep @smoke` against the preview (no local Supabase —
it talks to the hosted project with namespaced test accounts), then `treosh/lighthouse-ci-action@v12`
on the same URL with `continue-on-error: true`.

Merge rule: branch protection requires `static`, `build`, `components` and all six `e2e` matrix jobs;
the preview run is the post-merge-candidate confirmation the DoD asks for.

Visual baselines are **not** produced by CI: `npm run snapshots:update` runs the same specs inside
`mcr.microsoft.com/playwright:v1.63.0-noble` (`--ipc=host`) on the dev machine via Docker Desktop, and
the Linux PNGs are committed.

## 5. Flakiness risks and mitigations

| Risk | Why it bites here | Mitigation |
| --- | --- | --- |
| App reads characters from `keydown` | Ukrainian typing then produces **no events** under Playwright (and breaks real IME users) | Read from `beforeinput`/`input`/`compositionend` on a focused hidden textarea; keep one guard test asserting a Cyrillic character arrives with `keydown` count 0 |
| Firefox routes every non-US char through composition | Handlers that skip `isComposing` events drop every Ukrainian character on Firefox only | Explicit rule (§2.1) + Firefox is in the default matrix, not an optional project |
| `preventDefault()` on `beforeinput` ignored in Firefox | Sink textarea accumulates text, later characters mis-scored | Clear the sink's `value` after each handled `input` |
| Realtime race timing | Broadcast latency varies; `waitForTimeout` sleeps rot | Web-first assertions with a raised `expect` timeout for race specs; assert monotonic progress/ordering, never exact pixel positions or exact WPM |
| Parallel workers sharing Supabase rows | Cross-test interference, retry pollution | Unique emails/room codes per test (`crypto.randomUUID()`); `supabase db reset` once in global setup, not between tests; seed only reference data |
| Auth state expiry (`jwt_expiry` 3600 s) | Long shard runs start failing near the end | `setup` project regenerates `storageState` each run; raise `jwt_expiry` locally for tests |
| Screenshots differ Windows vs Linux | Every baseline diff is noise | Baselines only from `mcr.microsoft.com/playwright:v1.63.0-noble`; per-platform file names are automatic; `maxDiffPixelRatio` ~0.01 |
| Web fonts fetched at screenshot time | Network dependence and glyph shifts | Self-host font files; `await document.fonts.ready` before `toHaveScreenshot` |
| Animations / View Transitions (research 04) | Caret and progress bars mid-flight | App-level motion flag off in tests + `animations: 'disabled'`, `caret: 'hide'`, `reducedMotion: 'reduce'` |
| Headless Chromium frame throttling | Latency probe returns 300–900 ms garbage (measured) | `perf` project with `--disable-frame-rate-limit` and the three backgrounding flags; never run latency asserts in the default project |
| `clock.install()` fakes `rAF`/`performance` | Silently breaks typing animation and latency probes | Use `setFixedTime` by default; `install` only in countdown/idle specs |
| Supabase cold start in CI | First `supabase start` pulls images; health-check timeouts | Pin the CLI version, exclude unused containers, keep `supabase start` inside the job that needs it, allow a generous step timeout |
| Vercel preview protected | 401 HTML instead of the app; the failure looks like an app bug | `x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie: true`; fail fast in config if the secret is missing |
| Preview smoke hits the single hosted Supabase project | Two PRs racing on the same data | Namespaced accounts per run, read-mostly smoke subset, destructive specs local only |
| Retries hiding real bugs | "flaky" becomes the normal state | `retries: 1` maximum in CI, and treat any test that flips twice in a week as a bug, not noise |
| Test pollution of `localStorage` progress (TZ §8.9) | Reload test passes only because of leftovers | Fresh context per test; the reload spec explicitly writes, reloads and re-asserts |
| CRLF conversion on Windows | Dictionary checksums (TZ §8.7) differ between dev and CI | `.gitattributes`: `* text=auto eol=lf`, `dictionaries/** -text` |

## 6. Open questions

1. **Supabase cold start on `ubuntu-latest`**: real seconds for `supabase start -x …` and whether
   Docker layer caching is worth the complexity — unmeasurable here (Docker daemon stopped today).
   Measure on the first CI run and, if >3 min, consider running Postgres-only plus a hosted branch.
2. **Preview E2E backend**: point preview deployments at the single free hosted project (namespaced
   test accounts) or skip DB-touching specs in the preview smoke? One free project slot constrains us.
3. **Realtime fan-out limits** on the Supabase Free tier for multi-context race tests (how many
   simultaneous browser contexts before the tests get timing-flaky) — UNVERIFIED.
4. **Is Vitest browser mode worth a separate CI job**, or should the input-engine suite live inside
   Playwright as a component-ish spec? Cost is ~1 extra job and a second browser install.
5. **Dead keys / IME beyond Chromium**: accepted as Chromium-only automation. Do we add a short manual
   checklist for Firefox/WebKit before the demo, or rely on the engine-independence argument?
6. **Lighthouse target** (the 95+ figure in CLAUDE.md): measured on the preview URL or on a local
   production build? Shared-runner noise makes the former advisory at best.
7. **axe policy**: zero violations on all scanned screens, or a reviewed allowlist? Zero is achievable
   for a self-built UI but can block on contrast decisions from the design system.
8. **Local key material**: `supabase status -o env` in CI vs committing the well-known local
   publishable/secret keys to `.env.test` — the latter is simpler; whether the local keys are
   byte-identical across machines with the new key format is UNVERIFIED.

## 7. Sources

Playwright
- https://playwright.dev/docs/api/class-keyboard
- https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/input.ts
- https://github.com/microsoft/playwright/issues/3989 (custom keyboard layout, open, P3)
- https://github.com/microsoft/playwright/issues/7396 (Russian layout, closed as not planned)
- https://github.com/microsoft/playwright/issues/6267 (`type` does not raise all events)
- https://github.com/microsoft/playwright/issues/24107 (non-Latin characters)
- https://playwright.dev/docs/release-notes (1.63: Chromium 153 / Firefox 155 / WebKit 26.6)
- https://playwright.dev/docs/auth, /docs/clock, /docs/test-webserver, /docs/test-retries,
  /docs/test-parallel, /docs/test-sharding, /docs/test-snapshots, /docs/accessibility-testing,
  /docs/docker, /docs/api/class-browser#browser-new-context
- npm registry `playwright` dist-tags (latest 1.63.0, published 2026-09-04)

Supabase
- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/local-development/cli/config
- https://supabase.com/docs/reference/cli/supabase-start (`-x` container list incl. `mailpit`)
- https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://github.com/supabase/setup-cli (v3)
- https://github.com/supabase/cli/issues/5222 (Inbucket → Mailpit / `[local_smtp]`)
- https://github.com/axllent/mailpit and https://raw.githubusercontent.com/axllent/mailpit/master/server/ui/api/v1/swagger.json

Vercel / GitHub
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning

Other tools
- https://vitest.dev/guide/browser/ (Vitest 5.0.1)
- npm registry: `fast-check` 4.10.1, `@axe-core/playwright` 4.13.0, `vitest` 5.0.1, `@lhci/cli` 0.15.1,
  `supabase` 2.117.0
- https://github.com/treosh/lighthouse-ci-action (v12)
- https://github.com/gitleaks/gitleaks and https://github.com/gitleaks/gitleaks-action (v3)

Local experiments (2026-09-17, Windows 11, Playwright 1.63.0, outside the repo, scratchpad
`…/f5b4fc57…/scratchpad/pwlab/`)
- `kbd.mjs` / `kbd-out.json` — event traces for `type`, `press`, `insertText`, Alt/AltGr, Backspace,
  and CDP `Input.dispatchKeyEvent` / `Input.imeSetComposition`, in Chromium, Firefox, WebKit.
- `kbd2.mjs` / `kbd2-out.json` — no-focus behaviour, contenteditable, `beforeinput` cancellation,
  typing throughput.
- `latency.mjs` / `lat-out.json` + an inline Chromium re-run with anti-throttle flags — Event Timing
  availability and double-`rAF` paint timing per engine.
