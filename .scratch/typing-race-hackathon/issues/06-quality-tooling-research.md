# 06 Research: Tooling for real per-task E2E and quality gates

Type: research
Status: resolved
Blocked by: none

## Question

Which tools and techniques make "every task verified by real E2E tests" achievable and non-flaky for this app?

**Playwright** (current version):
- keyboard fidelity: `press`/`type` vs `insertText`, `key` vs `code`, typing Cyrillic under a ЙЦУКЕН mapping, dead keys and Alt, IME composition, in Chromium, Firefox and WebKit;
- multi-context tests for realtime races;
- auth state for tests.

**Environments and CI**
- Supabase local stack in E2E and in GitHub Actions (runtime, reliability).
- Running E2E against Vercel preview deployments: `deployment_status`, protection bypass.
- GitHub Actions limits for public repos.
- Windows + Docker Desktop developer constraints.

**Checks**
- Accessibility: `@axe-core/playwright`.
- Visual regression: built-in `toHaveScreenshot` vs free-for-OSS services.
- Vitest browser mode for component tests.
- fast-check property-based tests.
- Measuring keystroke-to-paint latency in tests: Event Timing API, INP.
- Lighthouse CI.
- Secret scanning: gitleaks.

## Deliverable

`docs/research/06-quality-tooling.md` on branch `research/06-quality-tooling`.

## Answer

Resolved 2026-09-17 by a research subagent. Findings: `docs/research/06-quality-tooling.md` on branch `research/06-quality-tooling` (commit `44e2581`, 672 lines, 7 sections). Verified with real experiments on Playwright 1.63.0 (Chromium 153, Firefox 155, WebKit 26.6); scripts are in the appendix.

**The decisive result: Cyrillic cannot be typed through the keyboard API.**
- `press('й')` **throws** `Unknown key`; `type('привіт')` silently falls back to `insertText`, so there is **no keydown/keyup for Cyrillic in any engine**. With nothing focused, Chromium and WebKit emit no events at all. Confirmed in Playwright's `input.ts` (`usKeyboardLayout` lookup) and issues #3989 / #7396.
- **Therefore the input engine must** read characters from `beforeinput` / `input` + `compositionend` on a focused hidden `<textarea>`, and use `keydown` only for control keys and `event.code` for finger hints. This matches research 03's finding about Monkeytype and keybr independently.
- **Firefox emits every non-US character as an IME composition** (`insertCompositionText`, `isComposing: true`) and **ignores `preventDefault()`** there, so the engine must commit on `compositionend` and clear the sink manually.
- **Chromium CDP restores full fidelity:** `Input.dispatchKeyEvent{key:'й', code:'KeyQ'}` produces a real trusted keydown plus text — this is how we simulate a physical ЙЦУКЕН layout — as do `key:'Dead'` and `Input.imeSetComposition`. There is no equivalent for Firefox or WebKit. Alt and Ctrl+Alt behave faithfully everywhere, so TZ §4.2 is testable cross-engine.
- **Latency measurement:** Event Timing only reports ≳16 ms, and default headless Chromium doesn't paint on schedule (measured 335–935 ms). With `--disable-frame-rate-limit` plus backgrounding flags it measures correctly (1–7 ms), so latency needs its own Chromium `perf` project.

**Proposed toolchain** (input for ticket 15)
- **Domain:** Vitest 5 + fast-check 4.
- **Input engine:** Vitest browser mode — jsdom cannot do composition.
- **E2E:** Playwright 1.63 against `vite preview`, with a setup project for `storageState`, multi-context races, and blob + `merge-reports` sharding.
- **Accessibility:** axe 4.13. **Visual:** `toHaveScreenshot` with Linux baselines from `mcr.microsoft.com/playwright:v1.63.0-noble`.
- **Backend:** Supabase CLI 2.117 local; Mailpit on :54324 captures auth mail so Resend is never called in tests; most test users via `admin.createUser({email_confirm:true})`.
- **CI:** `static | build | components | e2e (3 browsers × 2 shards) | e2e-report`, plus a `deployment_status` smoke run against the Vercel preview using `x-vercel-protection-bypass` and the bypass cookie.
- **Secrets:** gitleaks-action@v3 (no licence needed for a personal repo).

**Open questions** (for ticket 15)
- Supabase cold-start time in GitHub Actions (Docker was off locally, so unmeasured).
- Which backend the preview smoke run uses, given one free project slot.
- Realtime fan-out limits for N browser contexts.
- Where the Lighthouse target is measured.
- Whether axe policy is zero violations.
