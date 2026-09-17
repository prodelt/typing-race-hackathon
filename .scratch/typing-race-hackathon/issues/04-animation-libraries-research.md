# 04 Research: Animation libraries for smooth, disableable motion

Type: research
Status: resolved
Blocked by: none

## Question

Which animation tools deliver beautiful, smooth motion that can be turned off entirely and never degrades typing latency?

Candidates, verified as of September 2026:
- Motion (motion.dev, formerly Framer Motion)
- GSAP, including its licensing after the Webflow acquisition
- React Spring
- AutoAnimate
- the native View Transitions API
- CSS `@starting-style` and scroll-driven animations
- Rive
- Lottie / dotLottie
- PixiJS or canvas for a race track
- confetti/particle libraries

Evaluate each on:
- bundle size;
- main-thread vs compositor cost;
- framework compatibility (React, Svelte, Solid, Vue, since the stack is still open);
- license;
- `prefers-reduced-motion` support;
- production usage.

Map the candidates onto our motion surfaces:
- caret glide;
- per-character feedback;
- key-unlock celebration;
- results counters and charts;
- heatmap reveal;
- a race track with 2–8 racers;
- page and route transitions.

## Deliverable

`docs/research/04-animation-libraries.md` on branch `research/04-animation-libraries`.

## Answer

Resolved 2026-09-13 by a research subagent. Findings: `docs/research/04-animation-libraries.md` on branch `research/04-animation-libraries` (commit `5dca191`), with sources cited and uncertain items marked UNVERIFIED.

**Proposal** (input for ticket 11, not yet decided)

| Surface | Tool |
|---|---|
| Typing line and caret | Plain CSS (transform/opacity only) |
| Route/page changes | Same-document View Transitions API |
| Results, key unlocks, race finish | Motion, lazy-loaded so it never loads on the typing screen |
| Bursts | canvas-confetti |
| Toasts (optional) | AutoAnimate |

Rejected: GSAP, React Spring, Rive, Lottie/dotLottie, PixiJS. Race racers move as plain DOM elements. Total added JS is about 27 KB (published figures, not measured), none of it on the typing path.

**Key facts**
- **Motion 13.2.0 (MIT)**
  - Official for React 18/19, Vue and vanilla JS; no official Svelte or Solid adapter.
  - Lazy bundle is about 4.6 KB + 15 KB.
  - Its reduced-motion setting is off by default, so it must be enabled.
  - Shorthand `x`/`y`/`scale` animations are not GPU-accelerated.
  - Has a global skip-animations switch.
- **GSAP 3.15.0:** free for commercial use, but its license is not open source. It runs on the main thread and doesn't honor reduced motion by itself.
- **View Transitions (same-document)**
  - Supported: Chrome 111, Firefox 144, Safari 18. Cross-document transitions don't work in Firefox.
  - Capture freezes rendering, so never trigger one during typing.
  - React `<ViewTransition>` is exported by stable 19.3.0 but documented as canary.
- **CSS:** `@starting-style` and `linear()` are Baseline. Scroll-driven animations are not in stable Firefox.
- **Heavy runtimes rejected on weight:**
  - Rive: 270–610 KB WASM, and `.riv` export needs a paid editor plan;
  - dotLottie: 388 KB WASM;
  - lottie-web: stale since May 2025;
  - PixiJS: 258 KB, overkill for 2–8 racers.
- **Testing:** Playwright `reducedMotion` works in config. Screenshots freeze CSS and Web Animations only, not JS or canvas, so the app needs its own motion flag for deterministic tests.

**Open questions** (for tickets 11, 14 and 15)
- Router support for view transitions.
- Toggle states: system / reduced / off.
- Race update rate versus glide smoothness.
- Chart library.
- Whether animation assets come from a designer.
- How CI measures keystroke-to-paint latency.
