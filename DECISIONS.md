# Decisions

Everything below is settled and binding. One line of reasoning each — the long versions are in the
git tag `archive/process-harness-2026-09-30` (`git show <tag>:docs/adr/0004-...md`). Do not relitigate
these; change one only by editing this file first.

## Scope, decided 2026-09-30

The requirements make this unambiguous and it overrides anything below that disagrees.

**§11 refuses a submission that has no complete route through all three stages.** §10 lists a group
leaderboard, a real-time race mode, export/import and offline/PWA as *bonuses*, "counted only after
every mandatory requirement is met". §6 says progress is stored locally by default. So:

- **In scope, and the whole of it**: Stage 1 scales (done), **Stage 2 words built only from unlocked
  keys**, **Stage 3 Academy** with visible modules, progress and a completion criterion, the
  **dictionary pipeline** with reproducible derived data, the weak-key repetition mode, the session's
  fourth "real text" block, the sources-and-licences page naming what we actually use, and a
  deployed URL.
- **Out of scope for the demo**: accounts, Supabase, the sync outbox, races, leaderboards. Worth
  zero points until the three stages exist, and §11 separately refuses work whose mandatory
  functionality depends on a service that is unavailable during the demo. The code for these
  (`supabase/`, `apps/web/src/sync/`) **stays in the tree, dormant and untouched** — it is the only
  written version, and races become the first bonus if the mandatory work lands early.
- Progress is therefore **local only**, and "a new profile" in the jury script §9.1 means a clean
  local state plus a visible "start over", not an account.

## Product

1. **Accuracy is correct character keystrokes ÷ all character keystrokes.** An incorrect keystroke
   counts permanently, even when fixed with Backspace. Backspace is not in the denominator. This is
   the requirements' own wording and the one formula a demo will be checked against.
2. **Speed never gates anything.** It is displayed as the level benchmark. Mastery is three
   consecutive *test* attempts at or above the level's accuracy floor.
3. **Zero-peek.** In a test attempt the on-screen keyboard guide and the next-key highlight are
   hidden. Practice attempts show both.
4. **One next action.** After every attempt the learner is told exactly one thing to do next. Never
   two, never a list.
5. **Apostrophe** is stored as U+0027, displayed as U+2019, and both fold together on input.
6. **Key unlock follows the finger map, not letter frequency** — the order is pedagogical.
   Confidence is tracked per key *and* per transition; Ukrainian ЙЦУКЕН has 18.6% same-finger
   transitions against QWERTY's 5.8%, so transitions weigh more there.
7. ~~**Every screen is behind sign-in.**~~ Superseded by the scope decision above: there are no
   accounts for the demo, and progress lives in the browser. It must survive a browser restart,
   which is a graded automatic check (§8.9).
8. **Formulas are published in the app.** Our definitions differ from the requirements' example in one
   place (`rowChanges` counts adjacent row-changing pairs, not distinct rows touched), so the page
   states what we compute.

## Architecture

9. **Vite + React 19 SPA, TypeScript, pnpm workspace.** `apps/web` plus `engine`, `metrics`,
   `curriculum`, `ui`, `domain`.
10. **The keystroke path lives outside React.** A hidden focused textarea read through `beforeinput`
    and `compositionend`; `keydown` only for timing and modifiers. This is not a preference: no
    engine delivers a `keydown` for Cyrillic, and Playwright cannot type Cyrillic through the
    keyboard API. Firefox ignores `preventDefault()` on `beforeinput` and delivers non-US characters
    as IME compositions, so the engine commits on `compositionend` and clears the sink itself.
11. **An attempt is immutable: one row plus its keystroke event log.** Progress, unlocked keys and
    confidence are *derived* by folding over attempts, never edited in place. Cross-device conflicts
    therefore cannot happen. Keystroke logs are kept for the last 20 attempts and pruned after 30
    days; aggregates are kept forever (Supabase Free is 500 MB).
12. **The server recomputes every metric** in the `submit-attempt` Edge Function, importing the same
    `metrics` and `curriculum` packages the client uses. Clients never insert attempts directly.
    Consequence: those two packages must stay free of browser *and* Node APIs so they run under Deno.
    Attempt ids are client-generated UUIDs, so outbox retries are idempotent.
13. **Races: Broadcast for display, an Edge Function for truth.** Clients broadcast progress twice a
    second for the track animation only; the start is anchored to a server timestamp; the finish is
    validated by replaying the submitted keystroke log against the known race text. Live positions
    may be wrong, the ranked result cannot be, and the README says so honestly. 5 racers per room,
    2 msg/s each, against a Free-tier ceiling of 100 msg/s.
14. **The seam boundary.** No code outside `apps/web/src/seams/` touches IndexedDB, the Cache API,
    `performance.now()`, `Math.random()` or a DOM input event. `tools/architecture.test.ts` enforces
    it; the exemptions are listed there with reasons.
15. **State**: Zustand plus hand-written typed reducers, not XState. **i18n**: Paraglide.
    **Lint/format**: Biome. **Data**: TanStack Query. **Charts**: hand-written SVG.
    **Backend**: Supabase (Postgres, Auth, RLS, Realtime Broadcast, Edge Functions).
    **Deploy**: Vercel Hobby. **Tests**: Vitest, Playwright, fast-check, axe.

## Design — "Serene Script"

Paper-and-ink tactile ergonomics, calm soft-light palette, no eye fatigue over a long session. The
**light** theme is the default; dark and the low-vision preset are separate themes, not scale factors.

| role | light | dark |
|---|---|---|
| background, cream paper | `#FAF9F5` | `#F8FAF5` |
| text, soft slate | `#2D312E` | `#191C19` |
| correct / primary, sage | `#4A7C59` | `#316342` |
| error / attention, terracotta | `#D95D39` | `#BA1A1A` |
| upcoming / secondary, muted slate | `#94A3B8` | `#717971` |

Typing area `Source Serif 4` 28px/1.5 · UI `Source Sans 3` · metrics and shortcuts `JetBrains Mono`.
Finger colours (pinky violet, ring sage, middle ochre, index blue, thumbs grey), each as ink / tint /
line. Tokens live in `packages/ui/src/tokens.css` and `themes.css`.

**Motion rule — expressive frame, calm text.** Rich motion on results, unlocks, the race track and
route transitions; only caret glide and subtle character feedback inside the typing line. CSS-only in
the typing line, View Transitions for routes, lazy-loaded Motion for celebrations, canvas-confetti
for bursts. One app-level flag kills all motion and sound, which is also what makes screenshot tests
deterministic. Per-moment triggers, durations and easings: [`docs/design/motion.md`](docs/design/motion.md).
