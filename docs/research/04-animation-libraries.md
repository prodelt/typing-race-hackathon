# 04 Research: Animation libraries for smooth, disableable motion

Status: complete (research only, no code). Verified as of 2026-09-13. Ticket: `.scratch/typing-race-hackathon/issues/04-animation-libraries-research.md`.

Requirement driver: the TZ says "анімації та звук можна вимкнути" (animations and sound can be turned off) [S1].

Conventions:
- "min+gz" is the bundlephobia figure for the package's **full main entry** (not tree-shaken) unless a vendor figure is quoted [S2].
- "dl/wk" is npm downloads for 2026-09-05..2026-09-11 [S4].
- Browser versions are the first stable release per MDN browser-compat-data 8.1.1 (timestamp 2026-09-10) [S24].
- UNVERIFIED marks claims not confirmed against a primary source.

## 1. Summary

**Answer:** keep the typing line and everything near it on **native CSS** (compositor-only `transform`/`opacity` transitions, `@starting-style`, `linear()` easing). Use the **same-document View Transitions API** for route changes. Use **Motion** (MIT) for the rich "frame" moments: unlocks, results, race finish. Load it lazily as `m` + `LazyMotion` + `domAnimation` so none of it sits on the keystroke path. Add **canvas-confetti** (ISC) for bursts and, optionally, **AutoAnimate** (MIT) for toast and list reflow. Skip GSAP, React Spring, Rive, Lottie/dotLottie and PixiJS.

Key findings:
- **Motion 13.2.0** (2026-09-02, MIT):
  - Covers React 18/19, Vue (`motion-v`) and vanilla `animate()` [S3][S12].
  - Lazy `m` renders at 4.6kb plus 15kb for `domAnimation` [S5].
  - Hybrid engine: WAAPI handles full `transform`/`opacity`, but independent `x`/`y`/`scale` "are not accelerated" [S9].
  - `reducedMotion` defaults to `"never"`, so it must be set [S8]. `skipAnimations` exists globally and on `MotionConfig` [S13].
- **GSAP 3.15.0:**
  - All plugins are free including commercial use "thanks to Webflow" [S14].
  - The Standard License is non-OSI and bans use in competing no-code animation builders [S15].
  - It runs on a main-thread rAF ticker [S19] and has no automatic reduced-motion handling [S17].
- **React Spring 10.1.2:** MIT, 20.1 KB, React-only, JS rAF, `Globals.skipAnimation` [S2][S3][S20].
- **AutoAnimate 0.10.0:** MIT, 3.2 KB, framework-agnostic, auto-disables for reduced motion. It reads layout on every mutation, so keep it off the typing line [S2][S22][S23].
- **View Transitions (same-document):** Chrome 111, Firefox 144, Safari 18.
  - Cross-document is not supported in Firefox [S24].
  - The page is frozen during capture [S25].
  - React `<ViewTransition>` is documented against canary builds, although stable `react@19.3.0` exports it [S26][S27].
- **CSS features:**
  - `@starting-style` (117/129/17.5) and `linear()` (113/112/17.2) are safe everywhere.
  - Scroll-driven animations are not in stable Firefox; `interpolate-size` is Chromium-only [S24].
- **Rive:** MIT runtime, but 270–610 KB brotli of WASM, and `.riv` export needs a paid editor plan [S29][S30].
- **Lottie:**
  - dotLottie-web: 33 KB JS + 388 KB brotli WASM, can render in a Worker [S30][S31].
  - lottie-web: 76.8 KB, last release 2025-05-21 [S2][S3].
- **PixiJS 8.20.1:** 258 KB full entry [S2]. Overkill for 2–8 racers; DOM `transform` lanes suffice.
- **canvas-confetti 1.9.4:** 4.3 KB with `disableForReducedMotion` and `useWorker` [S2][S35].
- **Playwright:**
  - `testOptions.reducedMotion` (v1.50) [S37].
  - `toHaveScreenshot` freezes CSS/WAAPI animations by default but **not** JS/rAF or canvas animation [S38]. The app needs its own motion flag for tests.

Estimated added JS for the recommendation (vendor and bundlephobia figures, to be measured in our build) is about 27 KB. Everything is lazy-loaded outside the typing route: Motion lazy ~20kb, confetti 4.3 KB, AutoAnimate 3.2 KB.

## 2. Per-library findings with sources

### 2.1 Motion (motion.dev, formerly Framer Motion)

- **Version / license / usage:** `motion` 13.2.0 published 2026-09-02, MIT [S3]. The site says "MIT licensed and open source" and "Trusted by Framer and Figma" [S12]. Weekly downloads: `motion` 15.4M, `framer-motion` 34.3M (same 13.2.0 codebase) [S3][S4].
- **APIs:**
  - React components (`motion.*`, `m.*`), hooks and motion values.
  - Vanilla `animate()` [S10].
  - Vue through `motion-v` 2.4.2 (MIT, 0.48M dl/wk) [S3][S4].
  - The site lists JavaScript, React and Vue [S12]. There is no official Svelte or Solid adapter; use the vanilla `animate()` there (the adapter claim is UNVERIFIED beyond the site's framework list).
  - React peer range is `^18 || ^19` (optional peer) [S3].
- **Size:**
  - Vendor figures [S5]: `motion` component 34kb; `m` + `LazyMotion` 4.6kb initial render; `domAnimation` +15kb; `domMax` +25kb; `useAnimate` mini 2.3kb or hybrid 17kb.
  - Vanilla `animate()` [S10]: mini 2.3kb, hybrid 18kb. The docs do not say whether these figures are gzip (UNVERIFIED basis).
  - Bundlephobia full entry: `motion` 45.6 KB min+gz; `motion-v` 63.0 KB [S2].
  - Feature bundles [S5]: `domAnimation` covers "animations, variants, exit animations, and tap/hover/focus gestures"; `domMax` adds "pan/drag gestures and layout animations".
  - `LazyMotion` can load features asynchronously via dynamic `import()`. Its `strict` prop throws if a full `motion` component renders inside it [S5][S6].
- **Main thread vs compositor:**
  - A "Hybrid engine" combines JS and "hardware-accelerated browser APIs" [S12].
  - `transform` and `opacity` are "the safest values to animate". `filter`, `clip-path` and `background-color` are "gaining" acceleration [S9].
  - Caveat: independent transforms (`x`, `y`, `scale`) are animated through CSS variables and "currently these are not accelerated". Animate the full `transform` string for guaranteed acceleration [S9].
  - Springs, layout animations and `onUpdate` callbacks run in JS on the main thread (inferred from [S9]/[S10]).
  - Motion values "update the DOM without triggering a React re-render" (`.set()`, `.jump()`) [S11].
- **Reduced motion:**
  - `MotionConfig reducedMotion="user" | "always" | "never"`, default `"never"` [S8].
  - `"user"` disables transform and layout animations but keeps `opacity` and `backgroundColor` animating [S7].
  - The `useReducedMotion()` hook is available [S7].
- **Disable / test:**
  - `MotionGlobalConfig.skipAnimations` was added in 10.17.0 "to globally disable animations when testing" [S13].
  - `MotionConfig` gained a `skipAnimations` option in 12.30.0 (2026-02-02) [S13].
  - `useAnimate` respects `skipAnimations` since 12.39.0 [S13].
  - `MotionGlobalConfig.instantAnimations` exists since 12.7.5 [S13].
- **Verdict:** best fit as the primary JS animation library for frame surfaces. MIT license, React and Vue coverage, a vanilla fallback, built-in reduced-motion and skip switches.

### 2.2 GSAP

- **Version / license:**
  - `gsap` 3.15.0 published 2026-04-13. npm license field: "Standard 'no charge' license" [S3]. 3.49M dl/wk; `@gsap/react` 1.0M [S4].
  - Pricing page: "GSAP is now 100% free for all users, thanks to Webflow's support". This includes all plugins (SplitText, MorphSVG, DrawSVG, ScrollTrigger…) [S14].
  - The Standard License (effective 2025-04-30, updated 2025-05-30) permits commercial use in websites and apps [S15].
  - It forbids use in "tools that allow users to build visual animations without code" that compete with Webflow [S15].
  - It is **not an OSI open-source license**; Webflow retains the IP [S15].
- **Size:** core 27.4 KB min+gz; `@gsap/react` 0.55 KB [S2].
- **Main thread:** `gsap.ticker` "updates the globalTimeline on every requestAnimationFrame event". All tweens run in the JS main-thread loop, not on WAAPI or the compositor [S19].
- **Framework:** framework-agnostic.
  - React: `useGSAP()` is "a drop-in replacement for useEffect() or useLayoutEffect()" with automatic `gsap.context()` cleanup [S16].
  - It is Strict-Mode safe; `contextSafe()` covers handlers [S16].
- **Reduced motion:** not automatic. Use `gsap.matchMedia()` with a `(prefers-reduced-motion: reduce)` condition; matching animations revert when conditions change [S17].
- **Disable / test:** `gsap.globalTimeline.pause()` / `.timeScale()` affect "ALL animations" [S18].
- **Verdict:** capable, but it adds a non-OSI license to a public repo, runs every tween on the main thread, and provides nothing our surfaces need beyond Motion + CSS. Not recommended.

### 2.3 React Spring

- **Version / license:** `@react-spring/web` 10.1.2 published 2026-06-24, MIT [S3]. v10.0.0 (2025-05-14) added React 19 support; peers are React `^16.8 || … || ^19` [S3]. 3.89M dl/wk [S4].
- **Size:** 20.1 KB min+gz [S2].
- **Main thread:** physics runs in JS on the `@react-spring/rafz` rAF loop (dependency listed by bundlephobia [S2]). Nothing is offloaded to the compositor. The claim that no WAAPI path exists is UNVERIFIED.
- **Framework:** React only for `@react-spring/web`.
- **Reduced motion / test:** `useReducedMotion()` plus `Globals.assign({ skipAnimation: true })` jump animations to their goal value [S20][S21]. (react-spring.dev returned HTTP 403 to the fetcher; content confirmed via the official pages' search snippets.)
- **Verdict:** solid and MIT, but it overlaps Motion, is React-only, and is JS-driven. Not needed.

### 2.4 AutoAnimate (@formkit/auto-animate)

- **Version / license:** 0.10.0 published 2026-07-10, MIT; 1.14M dl/wk [S3][S4].
- **Size:** 3.2 KB min+gz [S2].
- **Framework:** React, Vue, Solid, Svelte, Angular, Preact, vanilla [S22].
- **Behaviour:** animates a parent's **direct children** when they are added, removed or moved [S22].
- **Mechanism:** the shipped source uses `MutationObserver`, `ResizeObserver`, `getBoundingClientRect` (layout reads) and `Element.animate` (WAAPI) [S23]. So there is a main-thread measure on every DOM mutation, followed by a compositor-friendly WAAPI animation.
- **Reduced motion:** on by default: it "will automatic disable if the user has indicated they want reduced motion" [S22]. The controller and hooks expose enable/disable [S22].
- **Verdict:** a good zero-config option for toast stacks, lobby lists and settings lists. **Never** attach it to the typing line, because its layout reads on every mutation would hit the keystroke path.

### 2.5 View Transitions API

- **Same-document (SPA)** via `document.startViewTransition()`: Chrome 111, Firefox 144, Safari 18 [S24].
  - `view-transition-name` and `:active-view-transition` have the same support range [S24].
  - `view-transition-class` is supported in Chrome 125, Firefox 144 and Safari 18.2 [S24].
  - Transition `types`: Chrome 125, Firefox 147, Safari 18.2 [S24].
- **Cross-document** (MPA, `@view-transition { navigation: auto }`): Chrome 126 and Safari 18.2. **Firefox: not supported** (bug 1860854) [S24]. This is irrelevant for an SPA.
- **Cost:** the snapshot animation runs as CSS animations on pseudo-elements. During the capture step "the page is frozen, so delays here should be kept to a minimum" [S25]. A transition must therefore never start while the user is typing.
- **React:** `<ViewTransition>` triggers only for updates inside `startTransition`, `<Suspense>` or `useDeferredValue` [S26].
  - react.dev examples pin a `19.3.0-canary` build [S26].
  - The stable `react@19.3.0` production build does export `ViewTransition` [S27][S3].
  - Its stability status in stable React is UNVERIFIED; treat it as experimental.
  - "React doesn't automatically disable animations" for reduced motion [S26].
- **Reduced motion:** not automatic. Chrome guidance: reduced motion "doesn't mean the user wants no motion", so offer subtler alternatives [S25].
- **Size:** 0 KB.
- **Verdict:** use for route and page transitions in all three engines, with a plain-navigation fallback.

### 2.6 CSS `@starting-style`, `transition-behavior`, scroll-driven animations, `linear()`, `@property`

| Feature | Chrome | Firefox | Safari | Use for us |
|---|---|---|---|---|
| `@starting-style` | 117 | 129 | 17.5 | entry animations for dialogs, toasts, heatmap cells [S24] |
| `transition-behavior: allow-discrete` | 117 | 129 | 17.4 | animate `display`/`<dialog>` exit [S24] |
| `animation-timeline` (scroll/view) | 115 | preview only (not stable) | 26 | not needed; progressive enhancement only [S24] |
| `linear()` easing | 113 | 112 | 17.2 | spring-like and bounce easings in pure CSS [S24] |
| `@property` | 85 | 128 | 16.4 | animatable typed custom properties (e.g. CSS counters) [S24] |
| `interpolate-size` | 129 | no | no | avoid (Chromium only) [S24] |
| `prefers-reduced-motion` | 74 | 63 | 10.1 | universal [S24] |
| `Element.animate` (WAAPI) | 36 | 48 | 13.1 | universal [S24] |

All are 0 KB and license-free. Playwright's screenshot `animations: "disabled"` stops CSS animations, CSS transitions and Web Animations [S38].

### 2.7 Rive

- **Version / license:** `@rive-app/canvas` 2.42.1, MIT runtime; 0.83M dl/wk. `@rive-app/react-canvas` 4.34.2, 0.74M dl/wk [S3][S4].
- **Editor:** the Free plan cannot export `.riv`; production export needs the Cadet plan at $9/seat/mo [S29].
- **Size:**
  - JS: `canvas` 52.7 KB, `canvas-lite` 45.4 KB, `react-canvas` 58.0 KB min+gz [S2].
  - WASM: `rive.wasm` 1.90 MB raw, 791 KB gzip, 610 KB brotli. Lite WASM: 855 KB raw, 353 KB gzip, 270 KB brotli [S30] (compressed with Node zlib, 2026-09-13).
- **Renderers:** `webgl2` (Rive Renderer, full features), `canvas`, and `canvas-lite` (no Text, Layouts, Scripting, Audio) [S28]. Rendering is per-frame WASM + canvas draw. Worker/OffscreenCanvas support is UNVERIFIED.
- **Reduced motion:** the docs offer accessibility examples with "strategies for respecting a user's reduced motion preferences"; nothing is automatic [S28]. Instances must be `cleanup()`-ed [S28].
- **Test:** canvas frames are not covered by Playwright's `animations: "disabled"` (which only covers CSS and WAAPI [S38]); needs an app-level flag.
- **Verdict:** beautiful state machines, but 270–610 KB of WASM, a paid editor for export, and a designer pipeline. Not recommended for a hackathon.

### 2.8 Lottie / dotLottie

- **`lottie-web`** 5.13.0, MIT, 76.8 KB min+gz; last npm release 2025-05-21 (about 16 months ago) [S2][S3]. Renderers: svg, canvas, html [S32]. 5.30M dl/wk [S4].
- **`@lottiefiles/dotlottie-web`** 0.80.0, MIT; 1.21M dl/wk [S3][S4].
  - JS is 33.0 KB min+gz [S2]. WASM is 1.24 MB raw, 499 KB gzip, 388 KB brotli [S30].
  - Rendering uses a "Rust + WASM core powered by ThorVG" with Canvas2D, WebGL2 or WebGPU backends [S31].
  - "DotLottieWorker renders on a Web Worker with an OffscreenCanvas", which keeps work off the main thread [S31].
  - "Freeze on offscreen" is available [S31].
  - Packages exist for React, Vue, Svelte, Solid and Web Components [S31].
- **Reduced motion:** nothing automatic documented (UNVERIFIED); the app must not autoplay when motion is off.
- **Verdict:** only worth it if a designer ships ready `.lottie` assets. Otherwise canvas-confetti + Motion cover celebrations at a fraction of the weight.

### 2.9 PixiJS vs Canvas 2D / DOM for the race track

- **PixiJS** 8.20.1 published 2026-08-26, MIT, 0.76M dl/wk [S3][S4].
  - Full entry is 258 KB min+gz [S2].
  - v8 ships as one package with manual-import support to trim extensions [S34]; the real tree-shaken size for our use is UNVERIFIED.
  - WebGL/WebGPU renderer, main-thread ticker.
  - The docs themselves say "Only optimize when you need to! PixiJS can handle a fair amount of content off the bat" [S33]. 2–8 sprites is trivial.
- **Canvas 2D:** 0 KB. `OffscreenCanvas` + `transferControlToOffscreen` is supported in Chrome 69, Firefox 105 and Safari 16.4 [S24], so a worker can render.
- **DOM + `transform`:** 0 KB. Compositor-driven when only `transform`/`opacity` change [S39]. Accessible text nodes for names and WPM. Playwright-friendly (locators, CSS transitions frozen in screenshots [S38]).
- **Verdict:** DOM lanes with `transform: translateX()` for 2–8 racers. PixiJS is overkill; Canvas 2D is the fallback only if particle trails are added.

### 2.10 canvas-confetti and similar

- **Version / license / usage:** `canvas-confetti` 1.9.4, ISC; 4.3 KB min+gz; 6.31M dl/wk [S2][S3][S4].
- **Options:**
  - `disableForReducedMotion` "Disables confetti entirely for users that prefer reduced motion" [S35].
  - `useWorker` renders in a web worker, off the main thread [S35].
  - `confetti.create(canvas)` limits the drawing area [S35].
  - `reset()` "Stops the animation and clears all confetti" [S35].
- **Test:** canvas output is not frozen by Playwright; gate calls behind the app motion flag.
- **Verdict:** use for key-unlock and personal-best bursts.

### 2.11 Framework-native options (context for the open framework decision)

- **Svelte 5:** `transition:`, `in:`, `out:` and `animate:` directives [S40].
  - The docs say "web animations can run off the main thread, preventing jank on slower devices" [S40].
  - Use `prefersReducedMotion` from `svelte/motion` [S40].
- **Vue:** `<Transition>` / `<TransitionGroup>` use CSS classes and JS hooks. The Vue docs advise `transform`/`opacity` and warn against `height`/`margin` [S41].
- **React:** no built-in besides the experimental `<ViewTransition>` [S26].

## 3. Comparison table

| Tool (version) | Size (min+gz) | Where work runs | Frameworks | License | Reduced motion | Playwright disable | Usage (dl/wk) |
|---|---|---|---|---|---|---|---|
| Motion 13.2.0 | 45.6 KB full entry. Vendor: `m`+`LazyMotion` 4.6kb, +15kb `domAnimation`; vanilla `animate` 2.3kb mini / 18kb hybrid [S2][S5][S10] | Hybrid: WAAPI (compositor) for full `transform`/`opacity`; JS main thread for springs, independent `x`/`y`, layout [S9] | React 18/19, Vue (`motion-v`), vanilla for Svelte/Solid [S3][S12] | MIT | `MotionConfig reducedMotion` (default `"never"`), `useReducedMotion` [S7][S8] | `MotionGlobalConfig.skipAnimations`, `MotionConfig skipAnimations` [S13]; `testOptions.reducedMotion` [S37] | 15.4M (+34.3M `framer-motion`) |
| GSAP 3.15.0 | 27.4 KB core, +0.55 KB `@gsap/react` [S2] | JS main thread, rAF ticker [S19] | Any; `useGSAP` for React [S16] | Standard "no charge", non-OSI, no-code-builder restriction [S15] | Manual via `gsap.matchMedia` [S17] | `gsap.globalTimeline.pause()/timeScale()` [S18] | 3.49M |
| React Spring 10.1.2 | 20.1 KB [S2] | JS main thread, rAF (`rafz`) [S2] | React 16.8–19 [S3] | MIT | `useReducedMotion` + `Globals.assign({skipAnimation})` [S20] | same `Globals` switch [S21] | 3.89M |
| AutoAnimate 0.10.0 | 3.2 KB [S2] | Layout read on mutation (main thread), then WAAPI [S23] | React, Vue, Svelte, Solid, Angular, Preact, vanilla [S22] | MIT | Automatic [S22] | CSS/WAAPI frozen in screenshots [S38]; `reducedMotion` disables it [S22][S37] | 1.14M |
| View Transitions (same-doc) | 0 | Page frozen during capture; CSS animations on pseudo-elements [S25] | Any; React `<ViewTransition>` experimental [S26] | n/a (platform) | Manual `@media` [S25][S26] | Skip `startViewTransition` behind flag; CSS frozen [S38] | Chrome 111 / FF 144 / Safari 18 [S24] |
| CSS `@starting-style`, `linear()`, transitions | 0 | Compositor if `transform`/`opacity` [S39] | Any | n/a | Manual `@media` | Frozen by `animations:"disabled"` [S38] | Baseline in all three engines [S24] |
| Rive 2.42.1 | 52.7 KB JS + 610 KB br WASM (lite 45.4 KB + 270 KB br) [S2][S30] | WASM + canvas per frame (main thread; worker UNVERIFIED) | Any; React wrapper [S3] | MIT runtime; export needs paid editor [S29] | Manual [S28] | Not frozen (canvas) | 0.83M |
| lottie-web 5.13.0 | 76.8 KB [S2] | JS main thread, SVG/canvas [S32] | Any | MIT | Manual (UNVERIFIED) | Not frozen (JS) | 5.30M |
| dotLottie-web 0.80.0 | 33.0 KB JS + 388 KB br WASM [S2][S30] | WASM; optional Worker + OffscreenCanvas [S31] | React, Vue, Svelte, Solid, WC [S31] | MIT | Manual (UNVERIFIED) | Not frozen (canvas) | 1.21M |
| PixiJS 8.20.1 | 258 KB full entry [S2] | WebGL/WebGPU, main-thread ticker [S33] | Any | MIT | Manual | Not frozen (canvas) | 0.76M |
| canvas-confetti 1.9.4 | 4.3 KB [S2] | Canvas; optional worker [S35] | Any | ISC | `disableForReducedMotion` [S35] | Not frozen (canvas) → gate by flag; `reset()` [S35] | 6.31M |

## 4. Surface-by-surface proposal

Recommendation in one line: **native CSS/WAAPI for everything in and near the typing line, View Transitions for routes, Motion (lazy `m` + `domAnimation`) for rich frame moments, canvas-confetti for celebrations.** No GSAP, Rive, Lottie or PixiJS.

The code below shows React/Motion names. If Svelte or Vue wins, swap in the framework built-ins [S40][S41] or `motion-v` / vanilla `animate()` [S10]. The CSS parts stay unchanged.

| Surface | Tool | How | Reduced / off behaviour |
|---|---|---|---|
| **Caret glide** | Native CSS | One absolutely positioned caret element. The target `x`/`y` comes from a glyph-offset cache measured once per line render or resize (never measured on keystroke). Apply `style.transform = translate3d(x,y,0)` with `transition: transform 80ms linear(...)` [S24][S39]. No library, no React re-render per key (write through a ref or a subscribed store). | `transition: none`: caret jumps. Blink via `opacity` keyframes; stop the blink when motion is off. |
| **Correct/error char feedback** | Native CSS | Toggle a class/attribute on the character span: `color` swap (paint of one glyph). An optional error cue uses a `::after` underline animated with `opacity`/`transform: scaleX` (compositor). No layout-affecting properties; do not switch spans to `inline-block` for a shake. | Instant colour change, no underline animation. The error still counts (logic is unaffected). |
| **Key-unlock celebration** | Motion `m` + `AnimatePresence` (lazy `domAnimation`) + canvas-confetti | Shown **after** the exercise ends, never mid-typing. Key-cap `scale`/`opacity` spring via full `transform` for WAAPI acceleration [S9]; `confetti({ disableForReducedMotion: true, useWorker: true })` on a scoped canvas [S35]. | `reducedMotion="user"` drops the transform and keeps the opacity fade [S7]; confetti is skipped [S35]; when the app flag is "off", `skipAnimations` [S13]. |
| **Results counters** | Motion `animate(from, to, { onUpdate })` or CSS `@property` integer + `counter()` [S24] | Count-up WPM, CPM and accuracy after the test; `font-variant-numeric: tabular-nums` to avoid reflow. Runs on the main thread, which is acceptable because typing is over. | Final values rendered immediately. |
| **Results charts** | Chart library TBD (separate decision) + CSS | Reveal with `clip-path` or `transform: scaleY` on the plot group, `opacity` fade [S9][S39]. Avoid animating SVG path `d` or width/height. | Static chart. |
| **Heatmap reveal** | Native CSS | Cells enter via `@starting-style { opacity:0; transform:scale(.9) }` [S24] with a staggered `transition-delay: calc(var(--i) * 12ms)`; colour appears with the fade. | No stagger; cells render in place. |
| **Live race track (2–8 racers)** | Native CSS (DOM lanes) | Each racer is a `transform: translateX(calc(var(--p) * track))` element. On each Realtime update set `--p` or `transform` and let a `transition: transform <update-interval> linear` interpolate on the compositor [S39]. The local racer's progress is coalesced to one write per animation frame, not per keystroke. Finish flourish with Motion or confetti. Fallback to Canvas 2D (+ OffscreenCanvas worker [S24]) only if trails or particles are added; PixiJS not needed [S33]. | `transition: none`: markers step to their positions; the numeric positions stay accessible. |
| **Route transitions** | View Transitions API (same-document) | Wrap router navigations in `document.startViewTransition()` when supported (Chrome 111 / FF 144 / Safari 18 [S24]). Name shared elements (`view-transition-name`) for results→lobby morphs. React's `<ViewTransition>` only if its experimental status is accepted [S26][S27]. **Never** start one while a typing session is active, because the page freezes during capture [S25]. | Call the update function directly without `startViewTransition`; optionally a crossfade only under `reduce` [S25]. |
| **Modals** | Native `<dialog>` + CSS | `@starting-style` + `transition-behavior: allow-discrete` for open and close [S24]; `opacity` + `transform: translateY/scale`. Motion `AnimatePresence` only if the framework requires exit orchestration. | Instant open and close. |
| **Toasts** | Native CSS + AutoAnimate (or Motion `layout` via `domMax`) | Enter via `@starting-style`; stack reflow via AutoAnimate on the toast container [S22]. Keep the container outside the typing-line subtree. | AutoAnimate self-disables [S22]; CSS off. |

## 5. Performance and accessibility rules

### 5.1 Performance: keep animation off the keystroke hot path

- **P1. Properties.** Animate only `transform` and `opacity` for anything that moves repeatedly [S39][S9].
  - `filter`, `clip-path` and `background-color` are allowed only for one-shot frame moments [S9].
  - Never animate `width`, `height`, `top`, `left`, `margin`, `padding` or `border-width` [S9][S39][S41].
- **P2. Motion acceleration.** When acceleration matters (race markers, key caps), pass a full `transform` string or use WAAPI (`animate` mini). Independent `x`/`y`/`scale` go through CSS variables and are not accelerated [S9].
- **P3. Hot path is library-free.** `keydown` goes to the typing store (pure logic), then a direct DOM write (class/attribute on the character span, `transform` on the caret) through a ref or subscription.
  - No animation-library call, no React state update of a parent tree, and **no layout read** in the handler.
  - Glyph offsets are measured once per line render and on resize, then cached.
- **P4. No mutation-observing animators in the typing subtree.** No AutoAnimate (it calls `getBoundingClientRect` on mutations [S23]) and no Motion `layout` there.
- **P5. Per-frame values bypass the framework.** Use refs, CSS custom properties, or Motion values, which "update the DOM without triggering a React re-render" [S11].
- **P6. `will-change: transform`** only on the caret and racer markers, not blanket; layers cost GPU memory [S9][S39].
- **P7. Coalesce secondary visuals.** Live WPM readout, own-racer progress and Realtime broadcasts write at most once per animation frame (or at the broadcast interval), never once per keystroke.
- **P8. Timing separation.** Celebrations, count-ups, chart reveals and confetti start only after the exercise ends. View transitions never start during an active session, because the page is frozen during capture [S25].
- **P9. Lazy-load the frame library.** Load Motion features via `LazyMotion` async `import()` [S5][S6], and import canvas-confetti dynamically on the results or unlock screen. The typing route's initial bundle contains no animation library.
- **P10. Canvas off the main thread** when used: `confetti` `useWorker: true` [S35]; OffscreenCanvas is available in all three engines [S24].
- **P11. Measure.** Add a Playwright performance check with motion `full` vs `off` (keydown timestamp to next frame, p95 < 16ms, delta ≈ 0). The measurement method is an open question (§7).

### 5.2 Accessibility and the disable switch

- **A1. One source of truth.** App setting `motion: "system" | "reduced" | "off"`, resolved with `matchMedia("(prefers-reduced-motion: reduce)")` [S24], is exposed as `<html data-motion="full|reduced|off">`. It is persisted with the user's settings, next to the separate sound toggle the TZ also requires [S1].
- **A2. CSS.**
  - Author motion under `[data-motion="full"]`.
  - `[data-motion="reduced"]` keeps short `opacity` fades only ("reduced motion doesn't mean no motion" [S25]).
  - `[data-motion="off"]` sets `animation: none; transition: none` for app elements, including `::view-transition-*` pseudo-elements.
- **A3. Motion.**
  - Wrap the app in `MotionConfig` with `reducedMotion` mapped from the flag (`"never"` for full, `"always"` for reduced/off), because the default is `"never"` [S8].
  - Set `skipAnimations` when off [S13].
  - Reduced mode keeps opacity and colour animations [S7].
- **A4. View Transitions.** Skip `startViewTransition` when off; crossfade-only when reduced [S25][S26].
- **A5. canvas-confetti.** Always pass `disableForReducedMotion: true` [S35] and do not call it when off.
- **A6. AutoAnimate.** It auto-disables for OS reduced motion [S22]. Call its `enable(false)` controller when the app flag is off [S22].
- **A7. Svelte/Vue.** If chosen, WAAPI-generated transitions are not affected by CSS media queries, so gate them with `prefersReducedMotion` from `svelte/motion` or the flag [S40].
- **A8. Never motion-only information.** Errors are shown by colour **and** an underline or mark. Race positions and final results are also rendered as text.
- **A9. No infinite decorative loops.** The caret blink is the only loop, and it stops when off. (WCAG 2.2.2 "Pause, Stop, Hide" relevance: UNVERIFIED, not fetched this session.)

### 5.3 Testability (Playwright)

- **T1.** Functional E2E projects set `use: { reducedMotion: "reduce" }` [S37]. One smoke project keeps `"no-preference"` to exercise full-motion paths.
- **T2.** `toHaveScreenshot` defaults to `animations: "disabled"`: finite CSS/WAAPI animations fast-forward to the end, infinite ones reset. The caret is hidden by default [S38].
- **T3.** JS/rAF and canvas animation (Motion springs, confetti, any canvas) is **not** frozen by T2 [S38].
  - Tests force `data-motion="off"` through the persisted setting (for example an init script or seeded storage state).
  - Test builds may also set `MotionGlobalConfig.skipAnimations = true` [S13].
- **T4.** E2E for the toggle itself: after switching it off, assert `data-motion="off"` and that `element.getAnimations()` is empty on the results and race surfaces (`getAnimations` is supported in Chrome 84, Firefox 75 and Safari 13.1 [S24]).

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Motion's `reducedMotion` defaults to `"never"`, so reduced-motion users get full motion if the config is forgotten [S8]. | A1/A3 root `MotionConfig`; E2E T4. |
| R2 | Motion independent transforms and springs run on the main thread and can jank during typing if misused [S9]. | P2/P3/P8; Motion stays out of the typing subtree. |
| R3 | Playwright screenshot freezing does not cover JS/canvas animation, causing flaky visual tests [S38]. | T3 app flag + `skipAnimations`. |
| R4 | A view transition freezes the page during capture, so keystrokes could stall if one fires mid-session [S25]. | P8 guard: never during an active session. |
| R5 | React `<ViewTransition>`: react.dev examples target canary even though `react@19.3.0` exports it [S26][S27]. API churn possible. | Use raw `document.startViewTransition` behind a small adapter. |
| R6 | Firefox lacks cross-document view transitions and stable scroll-driven animations; `interpolate-size` is Chromium-only [S24]. | SPA same-document only; do not depend on these features. |
| R7 | GSAP's non-OSI license with a no-code-builder restriction in a public repo could fail a license audit [S15]. | Not adopted; note it in the dependency policy. |
| R8 | Sizes are bundlephobia full-entry or vendor figures; Motion's figures do not state a compression basis [S2][S5]. | Measure the real Vite build (bundle visualizer) during implementation. |
| R9 | AutoAnimate's layout reads on mutation [S23] would add latency if applied near the typing line. | P4; lint or review rule. |
| R10 | lottie-web's latest release is 2025-05-21 [S3]; Rive export needs a paid plan [S29]. | Not adopted. |
| R11 | CSS-transition interpolation of racers can lag or overshoot with irregular Realtime intervals. | Tune duration to the measured broadcast rate; clamp to monotonic progress. |
| R12 | Some facts come from search snippets because react-spring.dev returned 403, and part of the PixiJS v8 manual-import guide was only seen via search [S20][S21][S34]. | Low decision impact: neither library is adopted. |

## 7. Open questions

1. **Framework:** React 19 vs Svelte 5 / Solid / Vue. This decides Motion for React vs `motion-v` vs vanilla `animate()` plus framework built-ins [S10][S40][S41]. The CSS plan is framework-neutral.
2. **Router:** which router, and does it offer a built-in View Transitions hook? Not researched; UNVERIFIED.
3. **Toggle semantics:** does the in-app toggle have three states (system/reduced/off), and may a user force full motion when the OS requests reduced motion?
4. **Race broadcast rate:** what update rate does Supabase Realtime deliver? It sets the racer transition duration (depends on the backend/realtime research ticket).
5. **Charts:** which chart library for results, and do its built-in animations respect the motion flag?
6. **Motion assets:** will a designer produce Rive/Lottie assets? If yes, dotLottie with `DotLottieWorker` is the least risky vector-animation path [S31].
7. **Latency measurement:** how is keystroke-to-paint measured in CI (Event Timing API vs custom marks), on what CPU throttling, and at what pass threshold?
8. **`skipAnimations` in production:** is `MotionConfig skipAnimations` intended for production use or only tests? The changelog documents it [S13] but the MotionConfig page fetched did not; confirm in a prototype.

## 8. Sources

Accessed 2026-09-13 unless noted.

- [S1] Local TZ: `tasks/Typing-Race-2026-Hackathon/docs/TECHNICAL_SPECIFICATION.md`, line 258.
- [S2] Bundlephobia size API: `https://bundlephobia.com/api/size?package=<pkg>`. Packages: motion, framer-motion, motion-v, gsap, @gsap/react, @react-spring/web@10.1.2, @formkit/auto-animate, @rive-app/canvas, @rive-app/canvas-lite, @rive-app/react-canvas, lottie-web, @lottiefiles/dotlottie-web, pixi.js, canvas-confetti.
- [S3] npm registry metadata: `https://registry.npmjs.org/<pkg>` and `/<pkg>/latest` (version, license, publish time, peerDependencies); `https://registry.npmjs.org/react/latest` (19.3.0).
- [S4] npm downloads API: `https://api.npmjs.org/downloads/point/last-week/<pkg>` (2026-09-05..2026-09-11).
- [S5] https://motion.dev/docs/react-reduce-bundle-size
- [S6] https://motion.dev/docs/react-lazy-motion
- [S7] https://motion.dev/docs/react-accessibility
- [S8] https://motion.dev/docs/react-motion-config
- [S9] https://motion.dev/docs/performance
- [S10] https://motion.dev/docs/animate
- [S11] https://motion.dev/docs/react-motion-value
- [S12] https://motion.dev/
- [S13] https://github.com/motiondivision/motion/blob/main/CHANGELOG.md (raw, head at 13.2.1-unreleased)
- [S14] https://gsap.com/pricing/
- [S15] https://gsap.com/community/standard-license/
- [S16] https://gsap.com/resources/React/
- [S17] https://gsap.com/docs/v3/GSAP/gsap.matchMedia()
- [S18] https://gsap.com/docs/v3/GSAP/gsap.globalTimeline
- [S19] https://gsap.com/docs/v3/GSAP/gsap.ticker
- [S20] https://www.react-spring.dev/docs/utilities/use-reduced-motion (403 to fetcher; search-snippet content)
- [S21] https://www.react-spring.dev/docs/guides/testing (403 to fetcher; search-snippet content)
- [S22] https://auto-animate.formkit.com/
- [S23] https://cdn.jsdelivr.net/npm/@formkit/auto-animate@0.10.0/index.mjs (shipped source inspected)
- [S24] MDN browser-compat-data 8.1.1, `https://unpkg.com/@mdn/browser-compat-data/data.json` (timestamp 2026-09-10). Keys: api.Document.startViewTransition, api.ViewTransition.types, css.at-rules.view-transition, css.properties.view-transition-name/-class, css.selectors.active-view-transition, css.at-rules.starting-style, css.properties.transition-behavior, css.properties.animation-timeline, css.types.easing-function.linear-function, css.at-rules.property, css.properties.interpolate-size, css.at-rules.media.prefers-reduced-motion, api.Element.animate, api.OffscreenCanvas, api.HTMLCanvasElement.transferControlToOffscreen.
- [S25] https://developer.chrome.com/docs/web-platform/view-transitions/same-document
- [S26] https://react.dev/reference/react/ViewTransition
- [S27] https://cdn.jsdelivr.net/npm/react@19.3.0/cjs/react.production.js (`exports.ViewTransition` present)
- [S28] https://rive.app/docs/runtimes/web/web-js
- [S29] https://rive.app/pricing
- [S30] jsDelivr file listings `https://data.jsdelivr.com/v1/packages/npm/@rive-app/canvas@2.42.1`, `…/@rive-app/canvas-lite@2.42.1`, `…/@lottiefiles/dotlottie-web@0.80.0`. WASM files downloaded from cdn.jsdelivr.net and compressed locally (Node zlib gzip level 9 / brotli default).
- [S31] https://github.com/LottieFiles/dotlottie-web
- [S32] https://github.com/airbnb/lottie-web
- [S33] https://pixijs.com/8.x/guides/concepts/performance-tips
- [S34] https://pixijs.com/8.x/guides/migrations/v8 (search-snippet content: single package, manual imports)
- [S35] https://github.com/catdad/canvas-confetti
- [S36] https://playwright.dev/docs/api/class-page#page-emulate-media
- [S37] https://playwright.dev/docs/api/class-testoptions#test-options-reduced-motion (`testOptions.reducedMotion`, added v1.50)
- [S38] https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-screenshot-1
- [S39] https://web.dev/articles/animations-guide
- [S40] https://svelte.dev/docs/svelte/transition
- [S41] https://vuejs.org/guide/built-ins/transition.html
