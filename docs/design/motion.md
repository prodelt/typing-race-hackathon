# Motion specification — "Serene Script"

Decided in [ticket 20](../../.scratch/typing-race-hackathon/issues/20-key-screen-mockups-and-motion-spec.md); the library choices come from [research 04](../research/04-animation-libraries.md). Hi-fi mockups: the Claude Design canvas "Typing-Race — Key Screens & Motion", source on branch `prototype/20-key-screens`.

## The rule

**Expressive frame, calm text.** Rich motion belongs to results, unlocks, the race track and route transitions. Inside the typing line only two things move: the caret, and the character that was just judged. Nothing else animates while an attempt is running — no card breathing, no progress spring, no shake on error. A learner in an attempt is reading; anything that moves next to the text steals a fixation.

Three hard consequences:

1. **No JavaScript animation runs per keystroke.** The typing line is CSS only. The keystroke path is outside React ([ADR-0003](../adr/0003-react-spa-with-input-engine-outside-the-framework.md)) and must stay inside the p95 keystroke-to-paint budget of 16 ms enforced in CI.
2. **Error feedback never moves the text.** A wrong keystroke changes colour, background and underline in place. Shake, jitter and horizontal nudge are forbidden: they reflow the line the learner is reading.
3. **Motion is never the only carrier of meaning.** Every animated state change also has a static form (colour, count, label), because the motion flag can be off and screenshot tests always run with it off.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 90 ms | in-place colour and tint changes in the typing line |
| `--dur-quick` | 140 ms | caret glide, next-key highlight, stream advance |
| `--dur-base` | 220 ms | chrome: chips, tiles, toasts, progress fills |
| `--dur-slow` | 420 ms | reveals with stagger, key unlock on the Path keyboard |
| `--dur-celebrate` | 900 ms | confetti burst, race-finish glow |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0.2, 1)` | default for anything that stays on screen |
| `--ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | elements appearing |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | elements leaving |
| `--ease-linear` | `linear` | race lanes between broadcasts, indeterminate bars |
| `--stagger-tile` | 60 ms | result metric tiles |
| `--stagger-bar` | 12 ms | rhythm-chart bars |

Durations are tokens, not literals: the motion flag sets them all to `0.01ms` in one place rather than each animation checking a condition.

## Layer 1 — the typing line (CSS only, always)

| Moment | Trigger | What moves | Duration · easing | Flag off |
|---|---|---|---|---|
| Caret glide | caret index changes | `transform: translateX()` on the caret element only | `--dur-quick` · `--ease-standard` | caret jumps to the new position |
| Correct character | correct keystroke committed | `color` to sage | `--dur-instant` · `--ease-standard` | colour changes instantly |
| Error mark | incorrect keystroke | `color`, `background`, `border-bottom` appear on the awaited character | `--dur-instant` · `--ease-standard` | appears instantly |
| Error cleared | correct character finally typed (stop-on-letter) or Backspace | the mark fades out | `--dur-instant` · `--ease-exit` | disappears instantly |
| Stream advance | the line scrolls to keep the caret centred | `transform: translateX()` on the text run | `--dur-quick` · `--ease-standard` | the run jumps |
| Block line scroll | the caret leaves the last visible line of a three-line block | `transform: translateY()` by exactly one line | `--dur-quick` · `--ease-standard` | the block jumps by a line |
| Next-key highlight | the awaited key changes | `background`, `border`, ring on one keycap | `--dur-quick` · `--ease-standard` | instant |
| Finger indicator | the awaited finger changes | `background` on one finger bar | `--dur-quick` · `--ease-standard` | instant |

Caret blink: 1 s step-end, paused while typing, stopped entirely when the flag is off. The caret is a separate element from the text, so its animation never invalidates the text layout.

## Layer 2 — the frame (View Transitions and lazy Motion)

| Moment | Trigger | What moves | Duration · easing | Implementation | Flag off |
|---|---|---|---|---|---|
| Route change | navigation | cross-document fade plus 8 px rise of the main column | `--dur-base` · `--ease-standard` | View Transitions API, CSS only | no transition |
| Result tiles | E4 mounts | 4 tiles fade and rise 8 px, staggered | `--dur-base` · `--ease-enter`, `--stagger-tile` | Motion, lazy-loaded on the result route | all tiles visible at once |
| Rhythm chart | E4 mounts, after the tiles | bars grow from the baseline, staggered | `--dur-slow` · `--ease-enter`, `--stagger-bar` | Motion | bars at final height |
| Key unlock card | E5 enters the result | card `scale(0.96 → 1)` and fade; the keycap glyph fades in 180 ms later | `--dur-slow` · `--ease-enter` | Motion | card static and complete |
| Unlock confetti | once, with the unlock card | one burst from the card centre, ~40 particles, sage and cream | `--dur-celebrate` | canvas-confetti | no burst |
| Path keyboard unlock | L2 after a new key | one keycap goes from locked grey to its finger tint | `--dur-slow` · `--ease-standard` | CSS | instant |
| Confidence bar change | any screen showing confidence | bar width | `--dur-base` · `--ease-standard` | CSS | instant |
| Guide tier change | a key's confidence crosses 0.5, 0.7 or 0.9 between attempts | the keycap's background, border and letter colour move to the next tier | `--dur-slow` · `--ease-standard` | CSS | instant |
| Session block advance | E6 between blocks | the block dot fills, the next label brightens | `--dur-base` · `--ease-standard` | CSS | instant |
| Sync badge | outbox length changes | fade and 4 px rise | 180 ms · `--ease-enter` | CSS | instant |
| Leaderboard reorder | new data | FLIP on the moved rows | 300 ms · `--ease-standard` | Motion | re-render in place |

## Layer 3 — the race

The race is the one place where motion carries live information, so it gets its own rules.

| Moment | Trigger | What moves | Duration · easing | Flag off |
|---|---|---|---|---|
| Lane progress | Broadcast progress, twice a second | each lane fill and its caret marker | 500 ms · `--ease-linear` | lanes jump on each update |
| Countdown | server-anchored start | the numeral `scale(1.15 → 1)` and fades, once per second | 300 ms · `--ease-exit` | numeral swaps |
| Start | countdown reaches zero | the text card border flashes sage once | `--dur-base` · `--ease-exit` | no flash |
| Validating | the finish RPC is running | one indeterminate bar, 1.2 s loop — the only looping animation in the product | 1.2 s · `--ease-linear` | static bar plus a "3 з 5 перевірено" counter |
| Finish | a validated result arrives | the winning lane glows, the podium cards rise staggered | `--dur-celebrate` / `--dur-base` | static podium |
| Race confetti | only when the viewer wins | one burst | `--dur-celebrate` | no burst |

Lane interpolation is **linear on purpose**: an ease on a 500 ms telemetry tick reads as jitter, not as speed. And it only ever interpolates *forward* — a late or out-of-order broadcast is dropped rather than animated backwards.

## The flag

One app-level setting, `motion: on | off`, stored with the profile and mirrored to `document.documentElement.dataset.motion`. It is initialised from `prefers-reduced-motion` and then owned by the user.

- `off` sets every duration token to `0.01ms`, disables caret blink, skips confetti calls entirely (the module is never imported), and turns the validating loop into a static bar.
- The same flag disables **all sound**. Sound is off by default regardless; it is never required to understand a state.
- Playwright sets `motion: off` for every screenshot and axe run, which is what makes those runs deterministic. The three keystroke-latency projects also run with it off, so the 16 ms budget is measured without animation noise.
- `prefers-reduced-motion: reduce` with no explicit user choice behaves exactly as `off`.

There is no middle setting. A "reduced" tier that keeps some animation would need its own screenshot baselines for no pedagogical gain.

## What deliberately has no motion

Focus rings, the typing card itself, the left rail, hover states on keycaps, the on-screen keyboard as a whole, and the metric tiles in the rail, which are frozen for the duration of an attempt and so have nothing to animate. There are two surfaces, not one: a single scrolling line for scales and words, a static three-line block for paragraphs, Academy text and races. Both animate only the caret and the judged character. No parallax, no scroll-driven animation, no skeleton shimmer — a paper surface with a static placeholder is calmer and cheaper.
