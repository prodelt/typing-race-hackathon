# 03 Research: Production frontend stack for a sub-16ms typing web app

Type: research
Status: resolved
Blocked by: none

## Question

Which frontend stack do production typing and realtime web apps actually use (verified as of September 2026), and which gives:
- the best keystroke-to-paint latency;
- small bundles;
- strong Supabase Auth integration;
- Vercel fit;
- reliable Playwright E2E;
- the smoothest multi-agent development?

Candidates to verify, with current versions and status:

| Area | Options |
|---|---|
| Framework | React 19 + Vite (React Compiler), Next.js, SvelteKit / Svelte 5, SolidStart / Solid, Vue 3 (Vapor) |
| Routing | TanStack Router, React Router |
| State | Zustand, Jotai, signals, XState for state machines |
| Server cache | TanStack Query |
| Styling | Tailwind CSS v4 |
| i18n | i18next, Lingui, Paraglide |
| PWA | vite-plugin-pwa / Workbox |

Also cover:
- input-handling techniques: `keydown` vs `beforeinput`, composition events, IME and dead keys, avoiding a re-render per keystroke;
- what Monkeytype and comparable apps really ship;
- benchmark evidence.

## Deliverable

`docs/research/03-frontend-stack.md` on branch `research/03-frontend-stack`: a comparison table plus a proposed recommendation. The decision itself is made in ticket "Stack & architecture".

## Answer

Resolved 2026-09-17 by a research subagent. Findings: `docs/research/03-frontend-stack.md` on branch `research/03-frontend-stack` (commit `88138be`, 445 lines).

**Proposal** (input for ticket 11, not yet decided): Vite 8 + React 19.3 SPA with the keystroke path kept outside React. Score 91/100 vs Svelte 5 at 85 and Solid at 81; on raw performance alone React, Svelte and Solid tie at 86–87, so the call hinges on how much agent ergonomics and stable versions are worth.

Stack: Vite 8, React 19.3 + React Compiler (UI only), TypeScript 7, TanStack Router, Zustand, TanStack Query, Tailwind 4, Paraglide JS 2 (uk/en), vite-plugin-pwa, supabase-js, Oxlint + oxfmt, Vitest, Playwright, pnpm. Runner-up: Svelte 5 with the same input engine.

**Key facts**
- **What real typing apps ship:** none uses Next.js or SvelteKit; all are plain client-rendered SPAs.
  - Monkeytype: Solid 1.9, Vite 8, Tailwind 4, TanStack Query, vite-plugin-pwa, Oxlint/oxfmt, pnpm, TypeScript 7.
  - keybr.com: React 19 + React Router 7, webpack.
- **Input engine (decisive):** both take the typed character from `beforeinput`/`input` plus composition events on a hidden textarea; `keydown` is used only for timing, modifiers and `event.code`. This is also the only approach Playwright can drive in Ukrainian — it emits only an `input` event for non-US characters, with no `keydown`.
- **Benchmark** (js-framework-benchmark, Chrome 152): Solid 1.13, Svelte 1.17, Vue 3.5 1.31, React 19 1.58, vanilla 1.04. React Compiler gives no gain there. If a keystroke never triggers a framework re-render, the gap largely stops mattering.
- **Bundle (agent's own esbuild measurement, brotli):** React 58 KB, Vue 19.5, Svelte 16.4, Solid 4.1. supabase-js alone adds 48 KB, so route splitting matters as much as framework choice.
- **Stable now:** React 19.3, React Compiler 1.0, Vite 8.3, TypeScript 7.0.2, Tailwind 4.3, Vitest 5.0, Playwright 1.63. Solid 2.0 and Vue 3.6 Vapor are still RCs.
- **TypeScript 7 caveat:** no programmatic API yet, so Svelte/Vue files and typescript-eslint can't use it; React and Solid get the full speedup.
- **Supabase/Vercel:** Auth behaves the same in any framework here (default flow is implicit); Vercel needs one rewrite rule for deep links.

**Risks**
- Monkeytype and keybr are GPL: study the patterns, never copy the code.
- TanStack Router's committed `routeTree.gen.ts` will cause merge conflicts across parallel worktrees.
- Several tools are brand new: Vitest 5, pnpm 12, oxfmt (pre-1.0).

**Open questions** (for tickets 11, 13, 15)
- Ergonomics vs raw performance weighting; latency target and whether CI enforces it.
- TanStack Router file-based or code-based routes.
- Plain reducers or XState for races.
- Oxlint or Biome; Vitest 5 and pnpm 12 or previous lines.
- PKCE or implicit auth flow.
- Behavior when an IME or the wrong keyboard layout is active.
