# 15 Grilling: Testing strategy & CI/CD pipeline

Type: grilling
Status: open
Blocked by: 06, 11

## Question

How does the agreed Definition of Done (see map Notes) become a concrete pipeline?

Decide:
- **Test layers per module:** Vitest TDD and property tests, Playwright E2E per acceptance scenario.
- **E2E scenario catalog** mapped to TZ §8 checks 1–10 and the §9 demo script.
- **Test data:** seeding, test users, local Supabase in Docker.
- **Browser matrix.**
- **GitHub Actions workflows:**
  - PR, main, preview deploy with E2E against the preview URL, nightly;
  - required checks and `main` protection.
- **Environments:** local, preview and production Supabase projects within free-plan limits. Research 05 §9: only **one** free Supabase project slot is left on the user's account, so plan around a single hosted project plus local Docker, or free a slot.
- **Secrets:** Vercel and GitHub secrets, `.env.example`.
- **Performance budgets:** keystroke latency, Lighthouse.

Inputs from research 06:
- Proposed toolchain: Vitest 5 + fast-check 4 for domain; Vitest browser mode for the input engine (jsdom cannot do composition); Playwright 1.63 over `vite preview` with a storageState setup project, multi-context races and sharded blob reports; axe 4.13; `toHaveScreenshot` with Linux baselines from the Playwright Docker image.
- Ukrainian typing in E2E requires Chromium CDP (`Input.dispatchKeyEvent` with key+code, `Input.imeSetComposition`); Firefox and WebKit have no equivalent, so cross-engine tests drive text through composition instead.
- Local Supabase with Mailpit on :54324 captures auth mail, so Resend is never called in tests.
- Latency needs a separate Chromium `perf` project with `--disable-frame-rate-limit`; Event Timing only resolves ≳16 ms.
- Proposed CI: `static | build | components | e2e (3 browsers × 2 shards) | e2e-report`, plus a `deployment_status` smoke against the Vercel preview.
- Open: Supabase cold-start time in Actions; which backend the preview smoke uses; Realtime fan-out for N contexts; Lighthouse measurement point; axe zero-violation policy.

## Answer
