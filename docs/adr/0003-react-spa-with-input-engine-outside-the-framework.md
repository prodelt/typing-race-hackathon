---
status: accepted
---

# React 19 + Vite SPA, with the keystroke path outside the framework

Typing-Race is a client-rendered React 19.3 + Vite 8 SPA in a pnpm workspace (`apps/web` plus `engine`, `metrics`, `curriculum`, `dictionary-pipeline`, `ui` packages). The input engine reads characters from `beforeinput` / `input` / `compositionend` on a hidden focused textarea, writes them to an append-only keystroke event log, and renders without going through React state on the hot path. Decided 2026-09-17 after research 02, 03, 04 and 06.

## Considered options

Svelte 5 (smaller bundle, but TypeScript 7 cannot process `.svelte` yet and agents are less fluent in it) and Solid (fastest in benchmarks). Rejected because the benchmark gap only matters if keystrokes re-render the framework — and they don't.

## Consequences

- **Reading the character from `keydown` is impossible, not merely suboptimal.** Playwright's `press('й')` throws and `type()` falls back to `insertText`, so no engine delivers a `keydown` for Cyrillic. An engine built on `keydown` could neither serve Ukrainian users nor be E2E-tested. Monkeytype and keybr independently arrived at the same hidden-input design.
- Firefox delivers every non-US character as an IME composition and ignores `preventDefault()` there, so the engine commits on `compositionend` and clears the sink itself.
- Metrics, per-key and per-transition stats, rhythm and replay are pure functions over the event log, which is what makes the TZ §8.1–8.2 checks provable.
- One lane owns one workspace package, which is how parallel agents avoid merge conflicts.
- Zustand holds app state; the exercise and race lifecycles are hand-written typed reducers rather than XState.
