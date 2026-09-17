# Wayfinder Map: Typing-Race — Implementation-Ready Documentation

## Destination

A complete, implementation-ready documentation package for the Typing-Race hackathon product (a UK/EN touch-typing trainer with live races and group ratings, TZ at `tasks/Typing-Race-2026-Hackathon/docs/TECHNICAL_SPECIFICATION.md`). The package contains:
- a Spec Kit spec, clarified;
- a plan with system design, data model, contracts and research;
- UI/UX flows and key-screen mockups in Claude Design;
- tasks split into parallel agent lanes;
- ADRs, an updated `CONTEXT.md`, the constitution and `AGENTS.md`.

The package passes `speckit-analyze` with no CRITICAL findings and is approved by the user. Implementation starts only after that.

## Notes

- **Domain:**
  - touch-typing pedagogy (finger-to-key binding, three stages, zero-peek test attempts);
  - frequency linguistics for UK/EN;
  - real-time multiplayer races;
  - group leaderboards.
- **Skills every session consults:**
  - `grilling` and `domain-modeling` for grilling tickets;
  - `research` for research tickets;
  - `prototype` and Claude Design (`design`) for prototype tickets;
  - `codebase-design` for architecture;
  - the Spec Kit skills (`speckit-*`) only once the fog graduates to spec/plan/tasks.
- **Language:**
  - agent-facing artifacts in English: map, tickets, spec, plan, tasks, ADR, `CONTEXT.md`, code, commits;
  - jury-facing docs in Ukrainian: README, `docs/pedagogy.md`, `docs/data-sources.md`, AI declaration;
  - UI in Ukrainian + English;
  - chat with the user in Ukrainian.
- **Plan, don't do:** no application code until the destination is reached and approved. The one "doing" ticket is the repo baseline.
- **Standing decisions (charting grill, 2026-09-13):**
  - **No deadline pressure.** Optimize for the best result. Work proceeds task by task to avoid production hell.
  - **Internal company hackathon, so be pragmatic.** Don't gold-plate compliance, terms-of-service, SLA or disqualification-risk analysis. Spend the effort on product quality, pedagogy, UX and tests.
  - **Product:** an online web app on Vercel (Hobby) + Supabase (Free). **Mandatory sign-in for every learner** ([ADR-0002](../../docs/adr/0002-mandatory-authentication.md)). The TZ §4.1/§6/§8.9 obligations still have to be met. Email auth goes through **Resend** as Supabase's custom SMTP.
  - **Scope:** every TZ mandatory requirement, plus bonuses: live races, group rating, cloud sync, export/import, adaptive slow-bigram generator, rhythm/error visualisation, offline/PWA, dark theme. Scalability is designed-in; how much the free tiers really carry is decided after research.
  - **Public repo** `https://github.com/prodelt/typing-race-hackathon`:
    - process artifacts are public;
    - third-party skill copies are not vendored;
    - zero secrets: keys live only in Vercel and GitHub secrets, only `.env.example` is committed;
    - organizer REVIEW_REQUIRED content is never committed;
    - folders are kept orderly from the first commit.
  - **Definition of Done per task:**
    - Vitest TDD, plus property tests for domain logic;
    - Playwright E2E for every user-visible acceptance scenario, with real browsers, real keyboard events and the production build;
    - server features tested against local Supabase in Docker, races with several browser contexts;
    - axe and screenshot checks;
    - CI gate: typecheck, lint, unit, E2E in Chromium/Firefox/WebKit, build, dictionary checksums, secret scan;
    - E2E re-run against the Vercel preview;
    - a task closes only with a link to a green run.
  - **Git:**
    - `main`, protected from the first code task onward;
    - one branch per task in its own worktree;
    - PR → CI → Vercel Preview → squash merge;
    - Conventional Commits and pre-commit hooks;
    - research on `research/<slug>` branches, folded into `docs/research/`.
  - **Content:** the curriculum is built from explicitly licensed sources (FrequencyWords MIT, dwyl Unlicense, …). Organizer materials are used only with written permission.
  - **Design:**
    - "Serene Script" light theme by default, dark theme as a bonus;
    - motion rule "expressive frame, calm text": rich motion on results, unlocks, race track and transitions; only caret glide and subtle character feedback in the typing line;
    - all motion and sound can be disabled;
    - mockups are made in Claude Design (Stitch screens are reference only).
  - **Team:** one human plus Claude Code as the primary agent, 3–4 parallel lanes via git worktrees.

## Decisions so far

- [Stitch design system & screens](archive/2026-09-03-map/02-stitch-design-system-and-screens.md) (from the superseded map): "Serene Script" tokens (paper cream, soft slate, sage green, terracotta; Source Serif 4 / Source Sans 3 / JetBrains Mono). Kept as the visual reference; new mockups move to Claude Design.
- [05 Research: What Supabase Free + Vercel Hobby can really carry](issues/05-supabase-vercel-free-tier-research.md): Realtime throughput (100 msg/s), not connections, is the binding limit (~10–20 concurrent races). Built-in email auth is unusable for demo sign-ups. One free Supabase project slot left. Proposed shape: a static SPA plus a private Realtime channel per race.
- [04 Research: Animation libraries for smooth, disableable motion](issues/04-animation-libraries-research.md): CSS-only typing line, View Transitions for routes, lazy-loaded Motion (MIT, ~20 KB) for results/unlocks/race finish, canvas-confetti for bursts. GSAP, Rive, Lottie and PixiJS rejected. An app-level motion flag is needed for deterministic E2E screenshots.
- [03 Research: Production frontend stack](issues/03-frontend-stack-research.md): real typing apps are plain client-rendered SPAs; the character comes from `beforeinput`/composition on a hidden textarea (the only path Playwright can drive in Ukrainian), with `keydown` for timing/modifiers only. Proposed: Vite 8 + React 19.3 with the keystroke path outside React; Svelte 5 runner-up.
- [02 Research: Leading typing trainers](issues/02-typing-trainers-teardown.md): keybr is the adaptive learning engine, Monkeytype the input loop; neither has a staged finger curriculum, an n-gram Academy or a next-step recommendation, and Ukrainian support is shallow everywhere. Adopt keybr-style confidence (applied to transitions, which nobody does) and Monkeytype's append-only keystroke event log with metrics as pure functions. Clean-room only: keybr is AGPL, Monkeytype GPL.
- [07 Research: Spec Kit × Pocock skills](issues/07-speckit-pocock-workflow-research.md): the parallel unit is the user-story phase, not the task; Spec Kit no longer makes branches and its active-feature state is gitignored, so one worktree per story works. Canonical chain: specify → clarify → plan → checklist → tasks → analyze, then implement per story with tdd inside, code-review, PR, converge per feature. Tests are opt-in in Spec Kit, so our E2E DoD must live in the constitution.
- [06 Research: Per-task E2E tooling](issues/06-quality-tooling-research.md): proven by experiment that Playwright cannot type Cyrillic through the keyboard API (`press('й')` throws; no keydown in any engine), so the input engine must read `beforeinput`/`compositionend` on a hidden textarea — Firefox even ignores `preventDefault()` there. Chromium CDP restores full fidelity for simulating a physical ЙЦУКЕН layout. Latency needs its own Chromium project with frame-rate limits off.
- [08 Research: Dictionaries](issues/08-dictionaries-licensing-research.md): all four sources are vendor-able (MIT code + per-file data licences; hunspell-uk used as a build-time filter only to sidestep its conflicting labels). Store apostrophe as U+0027, display U+2019, fold both sides. Measured: the uk frequency lists contain **no apostrophes at all**, a strict alphabet filter leaves Russian intact (`что` is the 5th-heaviest trigram) and hunspell membership cuts 50k to 27 184. ЙЦУКЕН has 18.58% same-finger transitions vs QWERTY 5.80%. Two TZ contradictions found: the §5.3 `rowChanges` example does not reproduce, and `ґ`, `-`, `'` have no finger in §2.

- [09 Grilling: Requirements beyond the TZ](issues/09-requirements-beyond-tz.md): in — event log with replay, plausibility checks, AFK exclusion, authority-computed race progress, accuracy-weighted scoring, confidence indicator outside test attempts, opposite-hand Shift check, weak-key fallback, low-vision preset, latency probe, public Formulas page, onboarding plus diagnostic, history page, command palette, uk/en switch. Later — pace caret, forecast, daily goal, ranks, error-free race. Out — image verification challenge, social sharing.
- [10 Grilling: Pedagogical model](issues/10-pedagogical-model.md): accuracy = correct divided by all character keystrokes (wrong presses count forever, Backspace not in the denominator); error ladder — stop-on-letter in Stage 1, free Backspace later, errors always visible in test attempts; mastery = 3 consecutive attempts at the accuracy floor and speed never gates; unlock follows the TZ finger map; confidence tracked per key **and per transition**, with the weakest element forced into every item; finger map extended for the apostrophe, backslash key, hyphen and digits per layout; an authored apostrophe word list, since frequency data has none; rowChanges = adjacent row-changing pairs; a 90 s skippable diagnostic; the 15–25 min session shape; explicit stage and Academy gates; a one-next-action rule engine with same-finger transitions weighted up for Ukrainian.
- [11 Grilling: Stack & architecture](issues/11-stack-and-architecture.md): React 19.3 + Vite 8 SPA with the keystroke path outside React ([ADR-0003](../../docs/adr/0003-react-spa-with-input-engine-outside-the-framework.md)); pnpm workspace with engine, metrics, curriculum, dictionary-pipeline and ui packages so one lane owns one package; Biome and Paraglide; Zustand plus hand-written typed reducers instead of XState; all dictionary work at build time into hashed per-unlock-set JSON; service-worker precache; TanStack Query with a 60 s leaderboard cache; hand-written SVG charts; p95 keystroke-to-paint at most 16 ms enforced in CI.

## Not yet specified

- **Key-screen mockups and a motion spec** in Claude Design, once the screen map and the animation-library choice exist.
- **System design:** component/deployment diagrams, data model, and API/Realtime channel contracts, once accounts, races and the dictionary pipeline are decided.
- **Jury-facing docs outline:** README, `docs/pedagogy.md`, `docs/data-sources.md`, AI-use declaration, privacy page content.
- **Spec Kit feature split:** one feature vs several. Then `speckit-specify` → `clarify` → `plan` → `tasks` → `analyze`, and the handoff to implementation lanes.

## Out of scope

- Vercel Hobby terms-of-service eligibility check ([19](issues/19-vercel-hobby-eligibility.md)): this is an internal company hackathon, and the user confirmed Hobby is fine.
- Outage-hardening against Supabase or Vercel unavailability (SLA analysis, demo fallback stacks): internal hackathon, so not worth the effort.

- Certification with PDF/QR diplomas and public verify URLs ([archived ticket](archive/2026-09-03-map/04-certification-system-and-verification.md)). Not a TZ criterion or bonus, and it competes with pedagogy for effort.
- Server-side keystroke replay anti-cheat. Only basic plausibility checks on results stay in scope.
- Custom course editor, additional keyboard layouts, mechanical-switch sound profiles.
- Mobile / virtual-keyboard typing. The TZ target is desktop with a physical keyboard, ≥1024px.
- Camera, microphone or biometric gaze control. Not required, and claiming guaranteed gaze control is forbidden (TZ §3.2, §6).
