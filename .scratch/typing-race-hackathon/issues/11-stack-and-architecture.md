# 11 Grilling: Stack & architecture

Type: grilling
Status: resolved
Blocked by: 03, 04, 05

## Question

Which stack and architectural shape do we build on?

Decide:
- framework and build tool;
- keystroke input engine approach;
- state management;
- routing;
- styling;
- animation library;
- server-cache layer;
- which Supabase features we use (Auth, Postgres, RLS, Realtime, Edge Functions);
- where computation lives (client vs database vs functions);
- caching strategy per layer (CDN, service worker, client cache, DB-side);
- the documented vertical/horizontal scaling path;
- repository folder layout;
- package manager.

Output: ADRs for every decision that is hard to reverse.

Inputs from research 05:
- Hosting is Vercel Hobby (confirmed fine for this internal hackathon).
- The proposed shape is a static SPA with no Vercel functions.

Inputs from research 06 (experimentally verified):
- The keystroke path must read `beforeinput`/`input` + `compositionend` on a focused hidden textarea; `keydown` only for control keys and `event.code` for finger mapping. Anything reading the character from `keydown` cannot handle Ukrainian and cannot be E2E-tested at all.
- Firefox delivers every non-US character as an IME composition and ignores `preventDefault()` there, so the engine commits on `compositionend` and clears the sink manually.
- The app needs an app-level motion flag and a deterministic test mode (see also research 04).

## Decisions — grilling round 1 (2026-09-17)

- **Framework:** React 19.3 + Vite 8. The keystroke path lives outside React, so the benchmark gap does not apply; ecosystem and agent ergonomics decide. Runner-up Svelte 5 rejected (TypeScript 7 cannot yet process `.svelte`, less familiar to agents).
- **Tooling:** pnpm (strict dependencies matter when several agents change packages in parallel), Biome 2 for lint + format (one stable tool; oxfmt is pre-1.0), Paraglide JS 2 for uk/en i18n (compile-time, no runtime).
- **Repository layout:** pnpm workspace — `apps/web` plus packages `engine` (input engine), `metrics`, `curriculum`, `dictionary-pipeline`, `ui`. One lane owns one package, which is what keeps parallel agents out of each other's files, and it enforces the deep-module rule.
- **State:** Zustand for app state; the exercise and race lifecycles are hand-written typed reducers (pure functions, property-testable). XState rejected as an extra API surface for a four-state machine.

Still open in this ticket: caching strategy per layer, where exercise generation runs, chart approach, theme/motion toggle states, PWA scope, the latency budget and whether CI enforces it.

## Answer

## Decisions — grilling round 2 (2026-09-17)

- **Where computation runs:** all dictionary processing happens at build time. The client receives ready-made JSON, chunked per unlocked-key set, with hashed filenames and immutable caching.
- **Service worker** precaches the app shell and the current stage's data, so basic training works offline (TZ §8.10 bonus).
- **Supabase data** through TanStack Query with a short stale time; leaderboards cached for 60 s.
- **Charts:** hand-written SVG components, no chart library. We need a keyboard heatmap, transition-latency bars and a progress line: little code, full control over theme and accessibility.
- **Performance budget:** p95 keystroke-to-paint at most 16 ms, measured by a dedicated Playwright project in CI (Chromium with frame-rate limiting off, per research 06); a regression fails the build.
- **Themes and motion:** system / light / dark and system / reduced / off, both honouring `prefers-reduced-motion`.

Resolved 2026-09-17. Supabase feature-level decisions (auth flows, RLS shape, Realtime channel design) belong to tickets 13 and 14.
