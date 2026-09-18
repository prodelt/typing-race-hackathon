# 15 Grilling: Testing strategy & CI/CD pipeline

Type: grilling
Status: resolved
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

## Decisions — grilling round 1 (2026-09-18)

- **Test layers:**
  - `metrics`, `curriculum`, `dictionary-pipeline`: Vitest + fast-check. Properties include: accuracy ∈ [0, 1]; a corrected error is always counted; `buildExercise` never emits a locked character (§8.3); every key has exactly one finger (§8.4); NFC is idempotent; the pipeline is deterministic (§8.8);
  - `engine`: Vitest browser mode on all three engines;
  - `sync`: **one contract suite run against both adapters** (in-memory and local Supabase);
  - RLS, RPCs and Edge Functions: Vitest integration tests against local Supabase acting as several users, asserting both allowed and denied access; no pgTAP;
  - `ui`: mainly E2E, with Vitest browser mode only for complex components (SVG charts, heatmap).
- **Coverage:** 100% lines and branches for `metrics`, `curriculum`, `dictionary-pipeline` and `engine`; no threshold elsewhere.
- **Browsers:** the full E2E suite runs on Chromium, Firefox and WebKit. CDP-dependent tests (physical ЙЦУКЕН simulation) are tagged `@chromium-only`; Firefox and WebKit enter text through composition.
- **Environments:** full E2E always runs against local Supabase in Docker. Vercel previews use the **production** project. The preview smoke signs in with dedicated test accounts flagged `profiles.is_test`, which are excluded from every leaderboard. A PR that contains a migration skips the preview smoke, and the smoke runs on production after merge.
- **Test data:** a local seed creates users via `admin.createUser({email_confirm: true})`, one user per test so shards never collide. Race texts come from `data/curriculum/`, and exercise seeds are fixed. Mailpit captures mail, so Resend is never called. A 5-racer race is 5 browser contexts in one test.
- **Budgets:**
  - p95 keystroke-to-paint ≤ 16 ms in a Chromium `perf` project;
  - Lighthouse (`lhci`) against `vite preview` in CI on landing, Formulas and the training screen: Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95;
  - `size-limit`: initial JS ≤ 150 KB gzip, with Motion and charts lazy-loaded.
- **axe:** zero violations of any impact. An exception needs a per-rule justification in an `a11y-exceptions` file and is reviewed in code review.
- **Screenshots:** the key screens from ticket 20, with motion off and Linux baselines from the Playwright image. A PR labelled `update-snapshots` triggers a workflow that commits the new baselines to the PR branch; nobody records baselines locally on Windows.

## Decisions — grilling round 2 and resolution (2026-09-18)

- **Workflows:**
  - `ci` (every PR and push to `main`):
    - `static`: typecheck, Biome, gitleaks, dictionary checksums and a pipeline re-run diff (§8.7–8.8);
    - `unit` with coverage;
    - `engine-browser` on 3 engines;
    - `build` + `size-limit`;
    - `e2e`: 3 browsers × 2 shards against local Supabase, including axe and screenshots;
    - `perf`, `lighthouse`, `e2e-report`;
  - `preview-smoke`: on `deployment_status`, skipped for PRs with migrations;
  - `deploy-backend`: on push to `main` — `supabase db push`, function deploy, `race_texts` seed, then a production smoke;
  - `nightly`: full E2E against production with test accounts, plus a report-only production Lighthouse run. It catches what local Docker cannot: real Realtime limits, OAuth, Resend;
  - `keepalive`: every 3 days;
  - `update-snapshots`: triggered by a PR label.
- **`main` protection** (switched on with the first code task):
  - every `ci` job is a required check, and `preview-smoke` is required whenever it ran;
  - PR-only, squash-only;
  - linear history, no force-push or deletion, branch up to date before merge;
  - no required human approval (a team of one); a `code-review` comment is mandatory instead.
- **Scenario catalogue:** `e2e/CATALOG.md` maps each scenario id `S-xx` to its source (TZ §8.n, §9.n or a spec acceptance scenario), its layer and its test tag. A `static` script fails when an id has no `@S-xx` test or a tag has no row. By layer:
  - §8.1, §8.2 and §8.4–8.8: unit/property;
  - §8.3: property **and** E2E;
  - §8.9 and §8.10: E2E;
  - one E2E per §9 demo step.

  The rows themselves are filled in during `speckit-tasks`.
- **Secrets:**
  - `.env.example` holds only the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which Vercel also holds for production and preview;
  - GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_AUTOMATION_BYPASS_SECRET`, test-account passwords;
  - Edge Function secrets (Resend, OAuth) via `supabase secrets set`;
  - gitleaks in pre-commit and CI.
- **Supabase cold start (rule for the first code task):** `supabase start -x` with the unused services excluded, and Docker images cached. If startup exceeds 3 min, start Supabase once per `e2e` job rather than per shard.

Resolved 2026-09-18.
