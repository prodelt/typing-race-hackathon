# 03 Research: Production frontend stack for a sub-16ms typing web app

Ticket: `.scratch/typing-race-hackathon/issues/03-frontend-stack-research.md`
Verified as of: 2026-09-13
Status: complete (proposal; the decision is made in the "Stack & architecture" ticket)

## 1. Summary

- **Production typing apps ship client-rendered SPAs, not meta-frameworks.**
  - Monkeytype runs **Solid 1.9 + Vite 8 + Tailwind 4 + TanStack Query + vite-plugin-pwa + Oxlint/oxfmt + pnpm + TS 7** [S2][S3].
  - keybr.com runs **React 19 + React Router 7** on webpack [S4].
  - A smaller Supabase-backed trainer (eletypes) uses React + Vite + PWA [S5].
- **Both leading apps take typed characters from `beforeinput`/`input` + `composition*` on a hidden textarea**, and use `keydown` only for timing, modifiers and `code` [S6][S7].
  - Playwright sends *only* `input` for non-US characters [S28].
  - So this design is also the only one E2E-testable for Ukrainian.
- **Framework speed differs about 1.4× on js-framework-benchmark (Chrome 152)**: Solid 1.13, Svelte 5 1.17, Vue 3.5 1.31, React 19 1.58; Vanilla is 1.04 [S20].
  - The React Compiler shows no gain there (1.64) [S20].
  - A keystroke path that bypasses framework rendering makes this gap largely irrelevant.
- **Measured brotli runtime:** React 58 KB, Vue 19.5, Svelte 16.4, Preact 4.9, Solid 4.1 [S21].
  - supabase-js alone adds 48 KB [S21], so code splitting matters as much as the framework.
- **Stable as of 2026-09-13** [S1][S8][S10][S13]:
  - React 19.3, React Compiler 1.0, Vite 8.3 (Rolldown), TS 7.0.2, Tailwind 4.3.3, Svelte 5.57, Vitest 5.0, Playwright 1.63.
  - Not yet stable: Solid 2.0 (RC.8), Vue 3.6 Vapor (RC.8), SvelteKit 3 (next). Jotai 3.0 is five days old.
- **TS 7 has no API yet.** Svelte/Vue tooling and typescript-eslint stay on TS 6 [S13]. TSX stacks (React/Solid) get the full 8–12× faster type checks for parallel agents.
- **Supabase Auth has no framework preference for an SPA**: plain `supabase-js` with browser sessions. `flowType` defaults to `implicit` [S25].
- **Vercel:** a Vite SPA deploys zero-config with a single rewrite rule [S16]. Next.js static export drops rewrites, headers, middleware and Server Actions [S11].
- **Proposal: React 19.3 SPA on Vite 8** with a framework-free input engine and TanStack Router, Zustand, TanStack Query, Tailwind 4, Paraglide JS 2, vite-plugin-pwa, Oxlint+oxfmt, Vitest, Playwright and pnpm. Weighted score 91/100.
  - **Runner-up:** Svelte 5 SPA (85).
  - Solid (81) is the best-evidenced performance option but faces the 2.0 migration.
  - Under a performance-first weighting, React, Svelte and Solid tie at 86–87 (§3).
- **Top risks:** routeTree/codegen conflicts across worktrees; very fresh majors (Vitest 5, pnpm 12, oxfmt 0.x); Playwright cannot exercise uk `keydown`/`code`; Monkeytype and keybr are GPL, so study their patterns but do not copy code into this repo.

## 2. Findings per area

Method: versions come from the npm registry `dist-tags` on 2026-09-13 [S1]. App stacks come from each repo's `package.json` via `gh api` [S2–S5]. Benchmark numbers are recomputed from js-framework-benchmark raw data [S20]. Bundle sizes were measured locally with esbuild in a throwaway directory outside the repo [S21]. The rest is from vendor docs and release posts.

### 2.1 What production typing apps ship

| App | Framework / UI | Build | Styling | State / data | Lint / format | Pkg mgr | Tests | Evidence |
|---|---|---|---|---|---|---|---|---|
| **Monkeytype** (largest OSS typing test, GPL-3.0, last commit 2026-08-15) | **Solid 1.9.13** (196 files import `solid-js`), plus a remaining `legacy-states/` imperative layer | **Vite 8.0.5**, `vite-plugin-solid`, **`vite-plugin-pwa` 1.1.0** | **Tailwind 4.3.2** (`@tailwindcss/vite`) + Sass | `@tanstack/solid-query` 5.101, `@tanstack/solid-db`, `@tanstack/solid-form`, `@tanstack/solid-hotkeys`, `idb`, Zod | **oxlint 1.77 type-aware + oxfmt**, ESLint only for JSON | **pnpm 11.21** + Turborepo | **Vitest 4.1**, Testing Library, happy-dom/jsdom | [S2][S3] |
| **keybr.com** (GPL-3, last commit 2026-04-13) | **React 19.2.4**, `react-router` 7.13, `react-intl` (FormatJS) | **webpack** (custom Node server with a websocket multiplayer) | Less CSS modules | its own packages (`keybr-textinput`, `keybr-keyboard`, `keybr-multiplayer-*`), Zod 4 | ESLint + Prettier + Stylelint | npm workspaces + lage | Testing Library | [S4] |
| **eletypes** (511★, last commit 2026-08-23) | React 18, MUI, styled-components | Vite 6, `vite-plugin-pwa` 1.2 | CSS-in-JS | **`@supabase/supabase-js` 2.103** | — | npm | — | [S5] |

Takeaways:
- Neither leading typing trainer uses a meta-framework (Next/SvelteKit). Both ship a **client-rendered SPA**.
- The fastest-moving project (Monkeytype) chose a **fine-grained reactive framework (Solid)** plus Vite 8, Tailwind 4, TanStack Query, PWA and the Oxc toolchain. Their old code is still visible as `legacy-states/`, which suggests a gradual rewrite into Solid (inference, not stated by the project).
- keybr shows **React 19 is viable** for a serious trainer. It gets there by keeping keystroke handling *outside* React: native listeners on a hidden `<textarea>` inside an `InputHandler` class, and a `memo`'d `TextEvents` component [S6].
- Both use **`input`/`beforeinput` plus `composition*` events for characters**, and use `keydown` only for timing, modifiers and `code` (§5) [S6][S7].
- Monkeytype's PWA and Tailwind 4 choices on Vite 8 are a production proof that these parts work together in 2026.

### 2.2 Framework

Versions on npm, 2026-09-13 [S1]:

| Candidate | Stable `latest` | Pre-release | Status notes |
|---|---|---|---|
| React + react-dom | **19.3.0** (2026-09-09) | canary 19.3 | Stable. |
| React Compiler (`babel-plugin-react-compiler`) | **1.0.0** (2025-10-07) | experimental | Stable, "fully production-ready". Meta Quest Store reports up to 12% faster loads and "certain interactions are more than 2.5× faster" [S8]. With `@vitejs/plugin-react` **6.x** it runs through `@rolldown/plugin-babel` + `reactCompilerPreset()`, because plugin-react v6 dropped its internal Babel for Oxc [S9][S10]. |
| Next.js | **16.3.5** (2026-09-11) | 16.4 canary | `output: 'export'` gives a static SPA/MPA, but it drops middleware/proxy, rewrites, redirects, headers, cookies, Server Actions, ISR and dynamic routes without `generateStaticParams` [S11]. Client components are still prerendered at build time, so `window`/`localStorage` must be read only inside effects [S11]. That is a hydration-boundary tax on an auth-gated, localStorage-heavy trainer. |
| Svelte / SvelteKit | **svelte 5.57.0**, **@sveltejs/kit 2.70.3** | kit 3.0.0-next.27 | Svelte 5 (runes) is stable. SvelteKit 3 is still in pre-release. |
| Solid / SolidStart | **solid-js 1.9.15**, **@solidjs/start 2.0.5** (2026-09-10), **@solidjs/router 1.0.0** | **solid-js 2.0.0-rc.8** (2026-09-11) | Solid 2.0 moved from beta (v2.0.0-beta.0, 2026-03-03 [S12]) to RC. A new project would start on 1.9 and face a 2.0 migration soon, or adopt the RC. |
| Vue | **3.5.42** | **3.6.0-rc.8** (2026-09-11) | Vapor Mode ships only in 3.6, still RC [S1]. The benchmark ran on 3.6.0-beta.17 [S20]. |

TypeScript 7 caveat [S13]: TS 7.0 (Go-native, GA 2026-07-08) has no programmatic API yet. The release post says "Workflows that use Vue, MDX, Astro, Svelte, and others will likely not yet be able to leverage TypeScript 7". Svelte and Vue language tooling therefore stays on TS 6 for now. React (TSX) and Solid (TSX) get the full 8–12× faster `tsc`.

### 2.3 Routing

- **TanStack Router `@tanstack/react-router` 1.170.36** (2026-09-13) [S1]:
  - File-based routing is "the preferred and recommended way", and code-based routing is supported [S14].
  - Its selling point is type safety: generated route linkages, typed params and search [S14].
  - The generated `routeTree.gen.ts` must be committed. The FAQ: "it is essentially part of your application's runtime, not a build artifact" [S15]. With parallel worktrees this one generated file will conflict whenever two agents add routes (see Risks).
  - Measured marginal cost: **25.0 KB brotli** [S21].
- **React Router `react-router` 8.3.1** (2026-08-28), v7 maintained as 7.18.3 [S1]. keybr uses 7.x [S4]. Measured marginal cost in data-router mode: **27.5 KB brotli** [S21]. Vercel documents it in both SPA and SSR modes [S16].
- The app has few routes (landing/auth, learning path, lesson, results, race lobby, race, leaderboards, profile, settings). Routing is not a latency factor. Pick on type safety and agent ergonomics.

### 2.4 State and state machines

npm, 2026-09-13 [S1]; sizes are measured marginal brotli [S21]:

| Library | Version | Size | Notes |
|---|---|---|---|
| Zustand | 5.0.15 | **0.4 KB** | The README's "Transient updates" pattern: `store.subscribe` lets code "bind to a state-portion without forcing re-render", with "drastic performance impact when you are allowed to mutate the view directly" [S17]. This is exactly the keystroke-path pattern. |
| Jotai | **3.0.0** (released 2026-09-08) | 2.8 KB | A new major five days old. Avoid for a time-boxed build. |
| XState | 5.33.0 | 10.8 KB | v6 in alpha (6.0.0-alpha.53). |
| `@xstate/store` | 4.2.3 | 2.7 KB | |
| `@xstate/react` | 6.1.0 | — | |
| `@preact/signals-react` | 3.12.0 | — | Patches React internals. The benchmark's signals and observable React variants were not faster than plain hooks (rank 115–139 band) [S20]. |

- Exercise and race lifecycles (idle → countdown → running → paused-on-error → finished → submitted) are small finite state machines. Choose between XState v5 (10.8 KB, visual/inspectable, strong for race multiplayer transitions) and a hand-written reducer: a pure TS discriminated union that is trivially Vitest-TDD'd and weighs 0 KB.
- The CLAUDE.md TDD mandate favours pure reducers in the core. XState can wrap them at the race-lobby level if needed.

### 2.5 Server cache

- **TanStack Query `@tanstack/react-query` 5.102.8** (v4 "previous"): 8.8 KB brotli marginal [S1][S21].
- Monkeytype uses the Solid adapter in production [S2].
- It fits Supabase reads such as leaderboards, profile and progress sync.
- It does not belong in the keystroke loop or in Realtime channels; those are push, not cache.

### 2.6 Styling

- **Tailwind CSS 4.3.3** plus **`@tailwindcss/vite` 4.3.3** [S1]. Monkeytype ships 4.3.2 on Vite 8 [S2].
- v4 targets **Chrome 111, Safari 16.4, Firefox 128**. It is "not designed to be used with CSS preprocessors like Sass, Less, or Stylus" [S18]. Serene Script tokens therefore belong in CSS variables / `@theme`, not Sass.
- Tailwind is build-time, so it has no runtime cost on the keystroke path.

### 2.7 i18n

UI in uk + en; sizes are measured marginal brotli [S21]:

| Library | Version [S1] | Size | Notes |
|---|---|---|---|
| i18next + react-i18next | 26.4.2 + 17.0.14 | **17.0 KB** | Runtime JSON catalogs, huge ecosystem, weakest typing. |
| Lingui core + react | 6.7.0 | **2.8 KB** | Compile-time ICU catalogs. Its macro needs Babel: `@lingui/vite-plugin` 6.7.0 peers on `@babel/core`, `@rolldown/plugin-babel` and `@lingui/babel-plugin-lingui-macro` [S39]. That adds a second Babel pass beside the React Compiler. |
| Paraglide JS `@inlang/paraglide-js` | 2.25.2 | not measured | Compiles each message to a tree-shakable ESM function; Vite plugin; peers `vite >=5`, `typescript >=5.6` [S39]. Vendor claim, not measured here: "47 KB vs 205 KB for 5 locales and 200 messages" vs i18next [S19]. Because messages are imported functions, a renamed or missing key should surface as a TS import/property error rather than a runtime fallback (inference from the compile-to-functions design; UNVERIFIED in a test project). No Babel needed. |

keybr uses FormatJS `react-intl` [S4], an ICU runtime like i18next's cost class (not measured here).

### 2.8 PWA

- **vite-plugin-pwa 1.3.0** (2026-05-05) and **workbox-build 7.4.1** [S1]. v1.3.0 release notes: "Add vite 8 peer dependency support" [S22].
- Monkeytype (1.1.0) and eletypes (1.2) both ship it [S2][S5].
- It satisfies TZ §8.10: basic training works offline after first load.
- Mandatory sign-in plus offline needs an explicit rule: cache the last Supabase session and let lessons run offline, while races require the network.

### 2.9 Tooling (Vite/Rolldown, lint/format, TypeScript, package manager)

- **Vite 8** (stable 2026-03-12, npm `latest` **8.3.0**, 2026-09-10). Rolldown is "its single, unified, Rust-based bundler … up to 10-30x faster builds", with most plugins working unchanged. It needs Node 20.19+/22.12+ [S10][S1]. `rolldown` itself is 1.2.8 [S1].
- **TypeScript 7.0.2**: Go-native, 8–12× faster full builds, no stable API until 7.1. typescript-eslint needs the `@typescript/typescript6` compatibility package [S13]. Monkeytype already runs TS 7.0.2 [S2].
- **Linters and formatters** [S1]:
  - Biome 2.5.13: type inference without `tsc`. Its `noFloatingPromises` catches "about 75% of the cases" typescript-eslint would [S23].
  - Oxlint 1.82.0 + oxfmt 0.67.0: type-aware via `oxlint-tsgolint` on typescript-go, which needs TS 7. It covers "59 out of 61 type-aware rules from typescript-eslint" and can replace a separate `tsc --noEmit` [S24]. Monkeytype uses Oxlint + oxfmt [S2][S3].
  - ESLint 10.10.0 + Prettier 3.9.6: widest plugin ecosystem, including `eslint-plugin-react-hooks` compiler rules [S8]. Slowest, and needs the TS 6 compat shim with TS 7 [S13].
- **Package managers** [S1]:
  - pnpm 12.4.1 (Monkeytype pins pnpm 11 via `packageManager` [S3]); Bun 1.4.2; npm ships with Node.
  - pnpm: "When packages are installed, their files are hard-linked from that single place, consuming no additional disk space" [S29]. This directly helps N parallel git worktrees, each with its own `node_modules`.
- **Vitest 5.0.0** (2026-09-03, v4 still maintained as 4.1.11); it needs Node `^22.12 || ^24 || >=26` [S39]. **Playwright 1.63.0** (2026-09-04) [S1].
- **Vite 8 plugin compatibility** (registry `peerDependencies` of `latest`) [S39]:
  - `vite-plugin-pwa` 1.3.0: `^8.0.0`.
  - `@tailwindcss/vite` 4.3.3: `^8`.
  - `@tanstack/router-plugin` 1.168.38: `>=8.0.0`.
  - `@vitejs/plugin-react` 6.1.1: **only** `^8.0.0`, with optional `babel-plugin-react-compiler ^1.0.0`.
  - `vitest` 5.0.0: `^8.0.0`.
  - Every proposed plugin is Vite-8 ready.

### 2.10 Supabase Auth, Vercel and Playwright fit

- **Supabase** [S1][S25]:
  - Package: `@supabase/supabase-js` 2.116.0 (v3 in `next`), 48.2 KB brotli marginal [S21], the largest single dependency.
  - `@supabase/ssr` 0.12.7 is only for cookie-based server rendering.
  - Default flow: auth-js source says `flowType`: "If set to 'pkce' PKCE flow. Defaults to the 'implicit' flow otherwise" [S25]. PKCE requires the "code exchange … on the same browser and device where the flow was started" [S26].
  - A pure SPA needs only `supabase-js` with browser-storage sessions. There is no server cookie plumbing, and no framework-specific advantage for Next or SvelteKit.
  - Supabase has first-party guides for React, Next, SvelteKit, Vue and Solid (UNVERIFIED individually; the backend ticket owns details).
- **Vercel**:
  - A Vite SPA deploys zero-config; deep links need a single `rewrites` rule to `/index.html` in `vercel.json` [S16].
  - SSR for Vite apps goes through Nitro [S16]. The Vercel page itself recommends MPA mode for production builds [S16], which is irrelevant for an auth-gated app.
  - Next.js on Vercel is first-class but adds Functions/SSR surface area the Hobby plan does not need.
- **Playwright**:
  - Supports **Chromium, WebKit and Firefox on Windows, Linux and macOS**; Windows 11+, Node 22/24/26 [S27].
  - Critical input finding [S28]: "For characters that are not on a US keyboard, only an `input` event will be sent". `keyboard.insertText` "Dispatches only `input` event, does not emit the `keydown`, `keyup` or `keypress` events".
  - So Ukrainian (Cyrillic) E2E typing produces **no `keydown` and no `code`**. An engine that derives characters from `keydown.key` would be untestable for uk in Playwright. An engine that takes characters from `beforeinput`/`input` works in all three browsers, framework-independently.

### 2.11 Benchmarks and bundle size

**js-framework-benchmark, Chrome 152 run (committed 2026-09-01)** [S20]:
- 188 keyed implementations.
- CPU column: weighted geometric mean of the 9 CPU benchmarks, using the site's own weights from `Common.ts`, factor vs. the fastest per benchmark (1.00 = best).
- Recomputed from raw `results.ts` with mean `total` duration. Numbers may differ in the 2nd decimal from the site's UI, which lets you choose median/mean.

| Rank | Implementation | CPU geomean | Ready mem (MB) | 1k rows mem (MB) | Brotli (KB) | First paint (ms) |
|---:|---|---:|---:|---:|---:|---:|
| 6 | vanillajs | 1.039 | 0.57 | 1.86 | 2.5 | 52.7 |
| 32 | vue-vapor 3.6.0-beta.17 | 1.123 | 0.73 | 3.19 | 17.6 | 71.4 |
| 38 | **solid 1.9.3** | **1.130** | 0.59 | 2.68 | 4.5 | 47.3 |
| 50 | **svelte 5.42.1** | **1.172** | 0.66 | 2.87 | 9.7 | 58.4 |
| 82 | vue 3.5.39 | 1.314 | 0.87 | 3.93 | 23.3 | 93.9 |
| 103 | preact-signals 10.29.8 | 1.399 | 0.68 | 5.03 | 8.2 | 55.1 |
| 125 | **react-hooks 19.2.0** | **1.582** | 1.19 | 4.44 | 51.4 | 221.4 |
| 136 | react-compiler-hooks 19.0.0 | 1.639 | 1.17 | 4.60 | 50.0 | 207.3 |
| 141 | react-zustand 19 + 5.0.2 | 1.691 | 1.18 | 6.11 | 49.8 | 218.0 |

Reading for this app:
- The benchmark measures **bulk table updates** (1k–10k rows). The typing loop instead updates **one or two character spans per keystroke**, which is a "select row" / "partial update" style operation.
- On those operations every framework finishes well inside one frame; the gap between Solid and React is a constant factor of about 1.4× in the aggregate.
- React Compiler brings **no gain on this benchmark** (1.639 vs 1.582 for plain hooks). Its wins come from avoiding cascading re-renders in large trees [S8], not the raw DOM update path.
- **The decisive latency factor is architecture, not framework.** If a keystroke triggers no framework render at all (direct DOM write, §5), every candidate converges to near the vanilla row. Monkeytype (imperative legacy core) and keybr (listeners outside React) both do this [S6][S7].

**Measured bundle sizes** [S21]:
- Setup: esbuild 0.28.2, `minify`, ESM, `NODE_ENV=production`, a trivial counter app per framework. Library rows are *marginal* cost with React external.
- Absolute app sizes will be larger; the relative order is what matters.

| Entry | min KB | gzip KB | brotli KB |
|---|---:|---:|---:|
| React 19.3 + react-dom | 217.6 | 67.4 | **58.0** |
| Vue 3.5.42 | 53.2 | 21.5 | 19.5 |
| Svelte 5.57 | 48.1 | 18.2 | 16.4 |
| Preact 10.29.8 | 12.8 | 5.4 | 4.9 |
| Solid 1.9.15 | 11.3 | 4.5 | **4.1** |
| + supabase-js 2.116 | 217.5 | 56.8 | 48.2 |
| + react-router 8.3.1 | 93.0 | 31.0 | 27.5 |
| + TanStack Router 1.170 | 76.7 | 27.6 | 25.0 |
| + i18next + react-i18next | 56.9 | 19.1 | 17.0 |
| + XState 5.33 | 35.4 | 11.8 | 10.8 |
| + TanStack Query 5.102 | 32.3 | 9.7 | 8.8 |
| + Jotai 3.0 | 7.3 | 3.2 | 2.8 |
| + Lingui core+react 6.7 | 7.3 | 3.1 | 2.8 |
| + @xstate/store 4.2 | 7.2 | 2.9 | 2.7 |
| + Zustand 5.0.15 | 0.6 | 0.4 | 0.4 |

Estimated brotli totals (sums; real totals will be somewhat lower from shared helpers and higher from app code):
- **React stack** (React + TanStack Router + Query + Zustand + supabase-js + Paraglide messages): ≈ **140 KB**.
- **Solid stack** (Solid + @solidjs/router + solid-query + supabase-js): ≈ **80 KB**. The Solid router and query adapters were not measured, so this total is UNVERIFIED and assumes sizes similar to the React adapters.
- Supabase-js alone is a third to a half of either total. Route-level code splitting (lazy race and leaderboard routes) matters more than the framework choice.

## 3. Comparison table (weighted score)

The scores are the author's judgement (1–5) and the weights are a proposal; each score cites the evidence in §2. Weighted total = Σ(score/5 × weight).

| Criterion (weight) | A. React 19.3 + Vite 8 SPA | B. Solid 1.9 + Vite 8 SPA | C. Svelte 5 + Vite 8 (SPA / Kit static) | D. Vue 3.5 (3.6 Vapor RC) + Vite 8 | E. Next 16 static export | F. Next 16 SSR on Vercel |
|---|---|---|---|---|---|---|
| Keystroke-to-paint latency headroom (25) | 4 (CPU geomean 1.58; converges to vanilla with a render-free engine) | 5 (1.13) | 5 (1.17) | 4 (1.31; Vapor 1.12 is RC) | 3 (React, plus hydration boundary) | 3 |
| Bundle size (10) | 3 (58 KB brotli) | 5 (4.1 KB) | 4 (16.4 KB) | 4 (19.5 KB) | 2 (React plus Next runtime; UNVERIFIED size) | 2 |
| Supabase Auth integration (10) | 5 (plain supabase-js SPA) | 5 | 5 | 5 | 4 (prerender and `localStorage` care [S11]) | 4 (`@supabase/ssr` cookie plumbing) |
| Vercel Hobby fit (10) | 5 (static plus one rewrite [S16]) | 5 | 5 | 5 | 5 | 4 (Functions surface) |
| Vitest / Playwright testability (10) | 5 (largest Testing Library ecosystem; engine is framework-free) | 4 | 4 | 4 | 4 | 3 (server components harder to unit test) |
| Multi-agent development (20) | 5 (TSX gets full TS 7 [S13]; typed router; largest docs and examples corpus) | 3 (reactivity footguns; 1.x→2.0 API drift confuses agents) | 3 (`.svelte` cannot use TS 7 yet [S13]; runes vs legacy syntax) | 3 (`.vue` cannot use TS 7 yet [S13]) | 4 (conventions, but server/client boundary mistakes) | 3 |
| Sept-2026 stability, no imminent major (15) | 5 (React 19.3, Compiler 1.0, Vite 8 all stable) | 2 (solid-js 2.0 RC.8 imminent [S1]) | 4 (Svelte 5 stable; Kit 3 in `next`) | 3 (Vapor only in RC) | 4 | 4 |
| **Weighted total (100)** | **91** | **81** | **85** | **77** | **73** | **65** |

Sensitivity check with a performance-first weighting (latency 35, bundle 15, Supabase 10, Vercel 5, tests 10, multi-agent 15, stability 10): **A 87, C 87, B 86**. The ranking between A, B and C therefore hinges on how much the team values multi-agent ergonomics and major-version stability against raw framework headroom. Next.js stays last under both weightings: its SSR/RSC strengths buy nothing for an auth-gated, client-heavy trainer.

**Sub-choices within the chosen framework:**

| Area | Pick | Runner-up | Why (evidence) |
|---|---|---|---|
| Routing | TanStack Router 1.170 | React Router 8.3 | Typed routes/search [S14]; similar size (25.0 vs 27.5 KB) [S21]; `routeTree.gen.ts` must be committed [S15], so conflict handling is needed (or use its code-based mode) |
| Session/UI state | Zustand 5.0.15 | Jotai 3.0 | 0.4 KB; transient `subscribe` without re-render [S17]; Jotai 3.0 is 5 days old [S1] |
| Exercise/race machines | Pure TS reducers (discriminated unions) | XState 5.33 for the race lobby | TDD-first, 0 KB; XState 10.8 KB [S21], v6 in alpha [S1] |
| Server cache | TanStack Query 5.102 | none (direct supabase-js) | 8.8 KB [S21]; Monkeytype uses it in production [S2] |
| Styling | Tailwind 4.3 + CSS variables | CSS modules | Build-time, no runtime; Vite 8 peer OK [S39]; Monkeytype uses it in production [S2] |
| i18n | Paraglide JS 2.25 | Lingui 6.7 | Compiled, tree-shaken, no Babel [S19][S39]; Lingui's macro needs a Babel pass [S39]; i18next is 17 KB [S21] |
| PWA | vite-plugin-pwa 1.3 / Workbox 7.4 | none | Vite 8 peer [S22][S39]; used by Monkeytype and eletypes [S2][S5] |
| Lint/format | Oxlint 1.82 (type-aware, tsgolint) + oxfmt 0.67 | Biome 2.5 | TS 7-native, 59/61 typed rules [S24]; used by Monkeytype [S2]. Biome's type inference is partial (~75% on floating promises) [S23]. ESLint needs the TS 6 shim under TS 7 [S13] |
| TypeScript | 7.0.2 | 6.x via `@typescript/typescript6` | 8–12× faster checks for N agents [S13] |
| Package manager | pnpm (pin via `packageManager`) | npm | Hard-linked store across worktrees [S29]; Monkeytype uses pnpm [S3] |
| Unit/E2E | Vitest 4.1.x or 5.0 + Testing Library; Playwright 1.63 | — | Vitest 5.0 is 10 days old [S1] (see Risks); Playwright covers 3 browsers on Windows [S27] |

## 4. Proposed stack and runner-up

This is a proposal; the decision belongs to the "Stack & architecture" ticket.

### Proposed: React 19 SPA on Vite 8 with a framework-free input engine

- **Runtime:** Node 24 LTS line (Monkeytype pins `>=24 <25` [S2]); pnpm pinned via `packageManager`.
- **Build:** Vite 8.3 (Rolldown) + `@vitejs/plugin-react` 6.1.
  - React Compiler 1.0 through `@rolldown/plugin-babel` + `reactCompilerPreset()` [S9], applied to UI components only.
  - Exclude the engine directory, and pin the compiler version exactly, as the React team advises when test coverage is limited [S8].
- **UI:** React 19.3, TypeScript 7.0 strict, Tailwind 4.3 via `@tailwindcss/vite`, Serene Script tokens in `@theme` CSS variables.
- **Routing:** TanStack Router 1.170. Code-based routes, or file-based with a "regenerate `routeTree.gen.ts`, never hand-merge" rule.
- **State:**
  - A pure TS **exercise engine** (reducer + imperative painter, §5) owns the keystroke loop.
  - Zustand 5 vanilla stores for settings/session, read with transient `subscribe`.
  - React renders only at exercise boundaries.
- **Data:**
  - `@supabase/supabase-js` 2.116 (SPA, browser session; set `flowType` explicitly after the backend ticket decides [S25][S26]).
  - TanStack Query 5 for leaderboards/profile.
  - Realtime handled in a non-React module.
- **i18n:** Paraglide JS 2 (uk/en). **PWA:** vite-plugin-pwa 1.3 (precache app shell, lessons and derived dictionaries).
- **Quality:** Oxlint (type-aware) + oxfmt; Vitest + Testing Library; Playwright (Chromium/Firefox/WebKit); a latency test using Event Timing plus a rAF probe (§5).
- **Deploy:** Vercel static output + `vercel.json` SPA rewrite [S16].

Why this over the faster frameworks:
- The latency gap between frameworks exists only on the render path, and the proposed engine keeps keystrokes off that path. keybr's React 19 production app does the same [S6].
- React then wins the criteria that decide a multi-agent hackathon: full TS 7 speed on every file [S13], every library already stable, and no imminent majors.
- The ~54 KB brotli React overhead [S21] is a one-time cached cost, not a per-keystroke one.

### Runner-up: Svelte 5 SPA on Vite 8

- The same engine, Tailwind, Paraglide, vite-plugin-pwa, supabase-js and Playwright choices carry over unchanged.
- Best raw headroom among stable majors (CPU 1.17, 16.4 KB) [S20][S21].
- Costs: `.svelte` files cannot use TS 7 yet [S13], SvelteKit 3 is in pre-release [S1], and there are fewer React-style library options (TanStack Query and Router have Svelte adapters of varying maturity; UNVERIFIED).

**Solid 1.9** (Monkeytype's choice [S2]) is the strongest performance-and-evidence option. It is not the runner-up only because solid-js 2.0 is at RC.8 [S1]: the team would choose between an imminent migration and building on an RC.

## 5. Input-engine design notes

These notes are framework-independent. They synthesise what Monkeytype and keybr ship [S6][S7] and the platform specs; every rule below has a source or is marked UNVERIFIED.

### 5.1 Capture surface: a hidden, focused `<textarea>`

- Both reference apps capture input on a real text control, not on `document` `keydown`:
  - keybr: a 1em `<textarea>` inside a 0×0 `overflow:hidden` wrapper, with `autoCapitalize="off" autoCorrect="off" spellCheck="false"` [S6].
  - Monkeytype: a dedicated input element with `beforeinput`/`input`/`composition*`/`keydown`/`keyup` listeners [S7].
- Only a text control receives OS text services: IME, dead-key composition, AltGr characters, autocorrect suppression.
- Keep the control focused whenever an exercise is active, and show a visible "click to focus" state on blur (TZ §6: visible focus).
- keybr resets the value to a non-empty sentinel (`"?"`) after each event: "otherwise Safari will not generate events `deleteContentBackward` and `deleteWordBackward`" [S6].

### 5.2 Which event carries what

| Need | Event / property | Rationale |
|---|---|---|
| **Typed character** | `beforeinput` (`inputType` `insertText`, `insertLineBreak`), with an `input` fallback | The character after layout, Shift, AltGr and dead-key resolution. Works for Cyrillic in Playwright, which sends *only* `input` for non-US characters [S28]. `beforeinput` is Baseline since March 2021 but "may fire but be non-cancelable … by IME", so "handle the `input` event and possibly revert" [S30]. Monkeytype double-checks in `input` because "some browsers (LIKE SAFARI) seem to ignore" `preventDefault` [S7]. |
| **Backspace / Ctrl+Backspace** | `inputType` `deleteContentBackward` / `deleteWordBackward` | Same path; matches both apps [S6][S7]. Backspace never removes an error from the error count (CLAUDE.md, TZ §4.3). |
| **Physical key → finger** | `keydown.code` | `code` "represents a physical key … isn't altered by keyboard layout or the state of the modifier keys" [S35]. ЙЦУКЕН and QWERTY share physical positions, so one `code → finger` table serves both (TZ §8.4). Supported since Chrome 48 / Firefox 38 / Safari 10.1 [S31]. |
| **Displayed / expected character** | layout table `char → code` (reverse map) | Playwright uk runs produce no `keydown` [S28], so analytics must derive the physical key from the *character* via the layout table and use `code` only as a cross-check or for layout-mismatch detection. |
| **Timing** | `event.timeStamp` of the `keydown` (or of `input` when there is no `keydown`) | Same clock as `performance.now()`. keybr timestamps from the event (`timeStampOf(event)`) and measures `timeToType` between keydown and input [S6]. Don't use `Date.now()`. |
| **Auto-repeat, synthetic events** | `event.repeat`, `event.isTrusted` | keybr drops repeats and, in production, untrusted events [S6]. Note: Playwright-dispatched events *are* trusted (UNVERIFIED), so the E2E path must not rely on dropping untrusted events. |
| **Shortcuts** (Esc restart, Tab) | `keydown.key` + `preventDefault` | keybr prevents `Tab` while typing [S6]. |

### 5.3 IME and composition

- Listen to `compositionstart`/`compositionupdate`/`compositionend`:
  - During composition, ignore `insertCompositionText` for scoring and show the pending text as "composing".
  - On `compositionend`, commit `event.data` as typed characters. keybr and Monkeytype both do exactly this [S6][S7].
- Monkeytype also ignores Firefox's extra `insertCompositionText` when `!event.isComposing` [S7].
- **Safari < 27**: "The `keydown` and `input` events dispatch after the `compositionend` … `isComposing` value is unexpectedly `false`" [S31]. Don't gate logic solely on `isComposing`; track composition state from the `composition*` events.
- **Policy for uk/en lessons (TZ §4.2):** an IME session must not break the attempt. Recommended: pause the timer during composition and show a non-blocking hint to disable the IME. Decide in the spec whether committed characters are scored (open question).

### 5.4 Dead keys and AltGr

- **Dead keys** (keybr's Windows 11 recordings, Chrome 130 and Firefox 132 [S6]):
  - `keydown code=Equal key=Dead` produces no `input`.
  - The next `keydown KeyA key=á` is followed by `input data=á`.
  - Rule: a `Dead` keydown starts no scoring and advances nothing; score on the resulting `input`. Record the dead key's `code` and timestamp so the transition latency includes it.
- **AltGr on Windows** is reported as "Both Alt and Ctrl keys are pressed, or AltGr key is pressed"; use `getModifierState("AltGraph")` [S32]. Monkeytype includes `AltGraph` in its modifier list [S33].
  - Rule: never treat `Ctrl+Alt+<key>` as an app shortcut when it produces an `input`.
  - Treat bare modifier keydowns (Alt, AltGraph, Shift, CapsLock, Meta) as non-events for scoring.
- **Accidental Alt/Option** (TZ §4.2): on Windows, a lone Alt press can move focus to browser chrome (UNVERIFIED per browser). Mitigation: on `blur` during an attempt, pause instead of failing, and refocus on the next click or keypress.

### 5.5 Layout check before start (TZ §4.2)

- `navigator.keyboard.getLayoutMap()` would reveal the active layout, but it is experimental and Chrome/Edge only (Chrome 69+, Firefox and Safari: no; secure context only) [S34].
- Use it only as a progressive enhancement. The universal fallback is a pre-start probe: "type the highlighted letter". If the committed character belongs to the wrong script (Latin vs Cyrillic), show "switch layout to Ukrainian/English" and do not start or score the attempt.
- Apostrophe normalisation (`'` vs `ʼ` vs `’`) happens in the comparison layer, never by rewriting `і/ї/є/ґ` (TZ §4.2, §8.5).

### 5.6 No framework render per keystroke

Target path: `beforeinput/input → engine.reduce(state, event) → painter.apply(diff)`, all synchronous in the event task. The browser then paints on the next frame.

1. **Render the exercise once.** The framework renders one `<span>` per grapheme for the current text window when the exercise loads. The painter keeps an array of span refs.
2. **Mutate the DOM directly per keystroke.**
   - Toggle a `data-state` attribute (`correct|error|current|pending`) on at most two to three spans.
   - Move the caret with `transform: translate()` (compositor-only), using positions measured *once* per layout (on render and on `ResizeObserver`). This avoids a read-after-write forced layout on every keystroke.
   - This is the "mutate the view directly" case the Zustand README endorses via transient `subscribe` [S17]. keybr keeps its handler in a class outside React behind a `memo`'d component [S6].
3. **Framework commits only at boundaries:** exercise start, line scroll or page change, finish, and results.
4. **Throttle derived UI.**
   - Live SPM and accuracy: update in `requestAnimationFrame` or ~250 ms intervals, never in the input handler.
   - Race progress broadcast (Supabase Realtime): throttle to a fixed rate (e.g. 5–10 Hz; exact limits belong to the backend ticket).
   - Opponent cursors: apply in rAF.
5. **Keep animations off the latency path** (TZ §6).
   - Animate only `transform`/`opacity` with CSS transitions or WAAPI.
   - Gate them with a store flag plus `prefers-reduced-motion`.
   - Never `await` in the keystroke handler; Monkeytype's handlers are `async`, which is a pattern to avoid for the hot path (design judgement).
6. **Why direct writes rather than rAF batching for the caret:** at 300 SPM the gap between keystrokes is ~200 ms, so one keystroke per frame is the norm. Writing immediately gets the change into the very next frame; rAF batching only helps key-rollover bursts. (Arithmetic from TZ §4.3 targets.)

### 5.7 Measuring latency

- **Event Timing API** (`PerformanceObserver({type: 'event', durationThreshold: 16, buffered: true})`) [S36][S37]:
  - `duration` spans "from `startTime` to the next rendering paint (rounded to the nearest 8ms)".
  - The minimum threshold is 16 ms, and entries are exposed by default only at ≥104 ms.
  - Support: Chrome 76, Firefox 89, Safari 26.2 (Baseline 2025). `interactionId` needs Chrome 96 / Firefox 144 / Safari 26.2.
  - Use it as a **guardrail**: in a Playwright Chromium run of a scripted 500-character exercise, assert **zero** `keydown`/`input` entries with `duration > 16`.
- **INP**: good ≤ 200 ms and poor > 500 ms at p75. Keyboard presses count, and it is split into input delay, processing and presentation delay [S38]. Report it in production telemetry (Vercel Analytics or a custom endpoint), but it is far too coarse for a 16 ms goal.
- **Fine-grained probe** (custom; the 8 ms rounding makes Event Timing unable to show sub-frame differences):
  - In the handler, record `t0 = event.timeStamp` and `t1 = performance.now()` after `painter.apply`.
  - In the next `requestAnimationFrame` callback, record `t2 = performance.now()`.
  - Track p50/p95 of `t1 - t0` (input delay + processing) and `t2 - t0` (≈ time to the frame that paints the change).
  - Show them in a dev overlay, and emit them in the Playwright perf test.

## 6. Risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | **GPL contamination.** Monkeytype (GPL-3.0) and keybr (GPL-3) are the best references [S2][S4]. Copying code into this public repo would impose GPL terms. | Medium / high | Study their behaviour and cite it; write original code. Record this in the dictionary/licence audit (judge-qa). |
| R2 | **Codegen merge conflicts across worktrees**: TanStack Router's committed `routeTree.gen.ts` [S15], Paraglide's compiled output, and lockfiles. | High / low-medium | Prefer code-based routes, or a "regenerate, never hand-merge" rule plus a CI check. Commit `project.inlang` sources, not compiled messages (verify Paraglide output location during scaffold). One agent owns lockfile changes. |
| R3 | **Fresh releases**: Vitest 5.0.0 (2026-09-03), pnpm 12.x (`latest` 12.4.1), oxfmt 0.67 (pre-1.0), Jotai 3.0 (2026-09-08), React Router 8 [S1]. | Medium / medium | Pin exact versions. Fall back to Vitest 4.1.11 / pnpm 11.26 if plugins lag. Avoid Jotai 3. |
| R4 | **TS 7 has no programmatic API** [S13]. Tools that embed TS (typescript-eslint, some Vite/Vitest type plugins, editors' Vue/Svelte support) need `@typescript/typescript6`. Oxlint's type-aware "rule coverage is incomplete" and "very large codebases may encounter high memory usage" [S24]. | Medium / medium | Keep `tsc` (TS 7) as the source of truth in CI and treat typed lint as advisory at first. |
| R5 | **React Compiler changes memoization**, which "can cause over or under-firing of `useEffect`" [S8]. | Low-medium / medium | Exclude the engine and realtime modules. Pin the compiler exactly [S8]. Keep effects out of the typing path. |
| R6 | **E2E blind spot**: Playwright emits no `keydown`/`code` for Cyrillic [S28], and whether its CDP-driven events report `isTrusted: true` is UNVERIFIED (secondary sources only). | High / medium | Engine logic must not depend on `keydown` for characters (§5.2). Unit-test `keydown`/dead-key/AltGr sequences with recorded fixtures (patterned on keybr's published event logs [S6], re-recorded ourselves because of R1). Don't filter `!isTrusted` in test builds. |
| R7 | **Safari quirks**: non-cancelable `beforeinput` [S30][S7]; `isComposing` ordering bug before Safari 27 [S31]; `deleteContentBackward` missing on an empty textarea [S6]. | Medium / low-medium | Use the `input` fallback, a sentinel value, and composition state tracked from events (§5). Run WebKit in CI [S27]. |
| R8 | **Latency measurement is coarse**: Event Timing rounds to 8 ms with a 16 ms minimum threshold [S36]. INP's "good" threshold is 200 ms [S38]. | High / low | Use the custom rAF probe (§5.7). Treat Event Timing as a guardrail only. |
| R9 | **Bundle weight dominated by supabase-js** (48 KB brotli) and React (58 KB) [S21]. The Lighthouse 95+ goal in CLAUDE.md is at risk on a cold load. | Medium / medium | Route-level lazy loading (race, leaderboards, charts), PWA precache, preload fonts. Measure with `vite build` + a bundle visualizer in the scaffold ticket. |
| R10 | **Mandatory sign-in vs. offline lessons and TZ privacy** (§6: progress local by default; §8.10: works offline after first load) [TZ]. | Medium / high (acceptance) | Keep the last session and local progress usable offline, and gate only races and leaderboards on network and auth. Needs an explicit spec decision. |
| R11 | **Vercel catch-all SPA rewrite vs. static assets** (`/sw.js`, `/assets/*`): the rewrites doc does not state filesystem precedence [S16]. UNVERIFIED. | Low / medium | Verify on the first preview deploy. If needed, narrow the source pattern to exclude files with extensions. |
| R12 | **Solid 2.0 / Vue 3.6 majors** land mid-project if either is chosen [S1]. | High if chosen / medium | This is part of why they rank below React in §3. |

## 7. Open questions

1. **Weighting.** Does the team accept React's framework overhead in exchange for multi-agent ergonomics and stability (score 91)? Or does it choose Svelte 5 / Solid for headroom (tie at 86–87 under performance-first weights)? For the "Stack & architecture" ticket.
2. **Latency budget definition.** Which interval counts: `event.timeStamp` → next rAF, or → presentation? What p95 target and reference hardware, and is it enforced in CI (Chromium only, or all three engines)?
3. **Routing mode.** TanStack Router file-based (typed, codegen conflicts) or code-based (no generated file)? Or React Router 8?
4. **State machines.** Pure reducers everywhere, or XState 5 for race-lobby orchestration (countdown, disconnect, reconnect)?
5. **Lint/format.** Oxlint + oxfmt (TS 7-native, pre-1.0 formatter) or Biome 2.5 (single stable binary, partial type inference)? Do Oxlint's React rules cover React Compiler's `eslint-plugin-react-hooks` checks? (UNVERIFIED)
6. **Version pins.** Vitest 5.0 vs 4.1, pnpm 12 vs 11, Node 24 vs 26.
7. **Auth flow.** PKCE vs implicit for supabase-js in the SPA (default implicit [S25]), OAuth providers, and the redirect URL handling on Vercel previews. For the backend ticket.
8. **IME / wrong-layout policy.** Pause without scoring, count as errors, or block start? This interacts with TZ §4.2 and CLAUDE.md's "errors count even when corrected".
9. **Offline + mandatory sign-in.** Exactly which features work signed-out or offline, to satisfy TZ §6/§8.10 (R10)?
10. **Paraglide and multi-agent conflicts.** Where does compiled output live, and is a missing key truly a type error? Verify in the scaffold (UNVERIFIED in §2.7).

## 8. Sources

All accessed 2026-09-13.

| ID | Source | Owner / type |
|---|---|---|
| S1 | npm registry `dist-tags` and `time`, `https://registry.npmjs.org/<pkg>`, for every package version cited | npm, primary |
| S2 | `monkeytypegame/monkeytype` `frontend/package.json`, https://github.com/monkeytypegame/monkeytype/blob/master/frontend/package.json; GitHub code search: 196 files under `frontend/src` importing `"solid-js"`; `frontend/src/ts` directory listing | Monkeytype repo, primary |
| S3 | `monkeytypegame/monkeytype` root `package.json` (`packageManager: pnpm@11.21.0`, oxfmt, turbo), https://github.com/monkeytypegame/monkeytype/blob/master/package.json | Monkeytype repo, primary |
| S4 | `aradzie/keybr.com` root `package.json` and `packages/` listing, https://github.com/aradzie/keybr.com/blob/master/package.json | keybr repo, primary |
| S5 | `gamer-ai/eletypes-frontend` `package.json`, https://github.com/gamer-ai/eletypes-frontend/blob/main/package.json | eletypes repo, primary |
| S6 | keybr `packages/keybr-textinput-events/lib/TextEvents.tsx`, `inputhandler.ts`, `browser-events(windows).md`; `packages/keybr-textinput-ui/lib/TextLines.tsx`, https://github.com/aradzie/keybr.com/tree/master/packages/keybr-textinput-events/lib | keybr repo, primary |
| S7 | Monkeytype `frontend/src/ts/input/listeners/input.ts`, `composition.ts`, `key.ts`, https://github.com/monkeytypegame/monkeytype/tree/master/frontend/src/ts/input/listeners | Monkeytype repo, primary |
| S8 | "React Compiler v1.0", react.dev blog, 2025-10-07, https://react.dev/blog/2025/10/07/react-compiler-1 | React team, primary |
| S9 | `@vitejs/plugin-react` README (React Compiler via `@rolldown/plugin-babel` + `reactCompilerPreset`), https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md | Vite team, primary |
| S10 | "Vite 8.0 is out!", 2026-03-12, https://vite.dev/blog/announcing-vite8 | Vite team, primary |
| S11 | Next.js docs, "How to create a static export" (v16.3.5, updated 2026-08-25), https://nextjs.org/docs/app/guides/static-exports | Vercel/Next.js, primary |
| S12 | Solid "Release v2.0.0 Beta – The <Suspense> is Over", https://github.com/solidjs/solid/releases/tag/v2.0.0-beta.0 | Solid team, primary (seen via search result; RC status from S1) |
| S13 | "Announcing TypeScript 7.0", 2026-07-08, https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ | Microsoft TypeScript team, primary |
| S14 | TanStack Router docs, File-Based Routing, https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing | TanStack, primary |
| S15 | TanStack Router FAQ (commit `routeTree.gen.ts`), https://tanstack.com/router/latest/docs/framework/react/faq | TanStack, primary |
| S16 | Vercel docs, "Vite on Vercel" (SPA rewrites; updated 2026-08-26), https://vercel.com/docs/frameworks/frontend/vite; "Rewrites on Vercel", https://vercel.com/docs/routing/rewrites | Vercel, primary |
| S17 | Zustand README, "Transient updates", https://github.com/pmndrs/zustand/blob/main/README.md | pmndrs, primary |
| S18 | Tailwind CSS docs, Compatibility, https://tailwindcss.com/docs/compatibility | Tailwind Labs, primary |
| S19 | Paraglide JS site (v2; size claim is the vendor's own), https://paraglidejs.com/ | inlang/Opral, primary (vendor claim) |
| S20 | js-framework-benchmark raw data `webdriver-ts-results/src/results.ts` + weights in `Common.ts`, commit "chrome152" 2026-09-01, https://github.com/krausest/js-framework-benchmark/tree/master/webdriver-ts-results/src; recomputed locally (weighted geomean of 9 CPU benchmarks, mean `total`, keyed only) | Stefan Krause, primary data |
| S21 | Local measurement, 2026-09-13: esbuild 0.28.2 `bundle+minify`, ESM, `NODE_ENV=production`; gzip level 9 and brotli via Node `zlib`; minimal counter per framework; libraries measured as marginal with React external; versions as listed in §2.11. Run in a temp directory outside the repo; script not committed. | This research, primary measurement |
| S22 | `vite-pwa/vite-plugin-pwa` releases (v1.3.0: "Add vite 8 peer dependency support"), https://github.com/vite-pwa/vite-plugin-pwa/releases | vite-pwa, primary |
| S23 | "Biome v2", 2025-06-17, https://biomejs.dev/blog/biome-v2/ | Biome team, primary |
| S24 | Oxc docs, "Type-aware linting", https://oxc.rs/docs/guide/usage/linter/type-aware.html | Oxc/VoidZero, primary |
| S25 | `supabase/supabase-js` `packages/core/auth-js/src/lib/types.ts` (`flowType` "Defaults to the 'implicit' flow"), https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/types.ts | Supabase, primary |
| S26 | Supabase docs, "PKCE flow", https://supabase.com/docs/guides/auth/sessions/pkce-flow | Supabase, primary |
| S27 | Playwright docs, Installation / System requirements, https://playwright.dev/docs/intro; Browsers, https://playwright.dev/docs/browsers | Microsoft Playwright, primary |
| S28 | Playwright API, `Keyboard` ("only an `input` event will be sent"; `insertText`), https://playwright.dev/docs/api/class-keyboard | Microsoft Playwright, primary |
| S29 | pnpm, "Motivation" (hard-linked content-addressable store), https://pnpm.io/motivation | pnpm, primary |
| S30 | MDN, `Element: beforeinput event`, https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event | MDN, primary reference |
| S31 | MDN browser-compat-data `api/KeyboardEvent.json` (`code`, `key`, `isComposing` Safari note, `getModifierState`), https://github.com/mdn/browser-compat-data/blob/main/api/KeyboardEvent.json | MDN BCD, primary data |
| S32 | MDN, `KeyboardEvent.getModifierState()` (AltGraph on Windows), https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState | MDN, primary reference |
| S33 | Monkeytype `frontend/src/ts/constants/modifier-keys.ts`, https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/constants/modifier-keys.ts | Monkeytype repo, primary |
| S34 | MDN, `Keyboard.getLayoutMap()`, https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap; BCD `api/Keyboard.json` (Chrome 69; Firefox/Safari none; experimental) | MDN, primary |
| S35 | MDN, `KeyboardEvent.code`, https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code | MDN, primary reference |
| S36 | MDN, `PerformanceEventTiming` (8 ms rounding, 16 ms minimum threshold, Baseline 2025), https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming | MDN, primary reference |
| S37 | MDN BCD `api/PerformanceEventTiming.json` (Chrome 76, Firefox 89, Safari 26.2; `interactionId` Chrome 96 / Firefox 144 / Safari 26.2), https://github.com/mdn/browser-compat-data/blob/main/api/PerformanceEventTiming.json | MDN BCD, primary data |
| S38 | web.dev, "Interaction to Next Paint (INP)", https://web.dev/articles/inp | Google Chrome team, primary |
| S39 | npm registry `https://registry.npmjs.org/<pkg>/latest` `peerDependencies`/`engines` for `vite-plugin-pwa`, `@tailwindcss/vite`, `@tanstack/router-plugin`, `@vitejs/plugin-react`, `@inlang/paraglide-js`, `@lingui/vite-plugin`, `vitest` | npm, primary |
| TZ | `tasks/Typing-Race-2026-Hackathon/docs/TECHNICAL_SPECIFICATION.md` §4, §6–§8 | Hackathon organisers, primary |

