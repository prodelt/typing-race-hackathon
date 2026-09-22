# 20 Prototype: Key-screen mockups & motion spec

Type: prototype
Status: resolved
Blocked by: 17

## Question

What do the key screens look like at full fidelity, and how does each one move?

Starting points:
- the screen map and the low-fi wireframes from ticket 17 (canvas "Typing-Race — Screen Map");
- the "Serene Script" tokens and the motion rule "expressive frame, calm text";
- the animation choices from ticket 04: CSS-only typing line, View Transitions for routes, lazy Motion for results/unlocks/race finish, canvas-confetti for bursts, one app-level motion flag.

Screens to cover:
- P0 About the product and P1 Sign-in;
- L1 Today, with the next action and the session plan;
- L2 Path, with the Stage 1 finger keyboard and the confidence shading;
- E2/E3 Typing in practice and in a test attempt, including the error and caret states;
- E4 Result with the E5 key-unlock card;
- R2 Race room across its states (gathering, 3-2-1, racing, validating, result);
- dark theme and the low-vision preset for at least the typing screen.

Deliverable: hi-fi mockups in Claude Design on the same canvas or a sibling one, plus a short motion spec. For each animated moment the spec gives the trigger, duration, easing and the reduced / off behaviour.

## Answer

## Decisions — prototype review (2026-09-22)

Assets: the hi-fi canvas in Claude Design, "Typing-Race — Key Screens & Motion" (private artifact `https://claude.ai/artifact/Hh57fpegLfsAB8RudvEfKo`), source captured on the throwaway branch `prototype/20-key-screens` under `prototypes/20-key-screens/`; the motion specification at [docs/design/motion.md](../../../docs/design/motion.md).

Eleven artboards. Step 1 compared three structurally different typing screens: **A «Потік»** (single scrolling line, no chrome during an attempt, a hand diagram instead of a keyboard), **B «Абзац»** (workstation: nav, left rail, live metric tiles, three-line paper card, full ЙЦУКЕН with confidence shading), **C «Аркуш»** (the whole exercise as a notebook page, error marks kept in the margin, a per-line ledger, a finger strip). Step 2 built the winner plus P0, P1, L1, L2, E4+E5, R2 in five states and a three-theme band.

**Chosen: the rail from B plus the line from A.** A alone has nowhere to put the one next action while an attempt runs; C makes the eye wander the page, which fights blind typing.

**Decisions:**

1. **Typing screen = a 276 px left rail plus a single-line stream.** The rail holds the session blocks, the one next action, live metrics, confidence by transition and the weakest transition. The centre holds one line at 44 px Source Serif 4 with edge fades, vertically centred. The line is the only thing in the optical centre.
2. **Live metrics moved off the text into the rail** as a 2×2 grid. Nothing numeric sits above or below the typing line during an attempt.
3. **The on-screen guide stays the full ЙЦУКЕН**, not A's hand diagram: the TZ requires a keyboard guide and the confidence heatmap needs every key. A's hand diagram is kept as a secondary indicator beside the next-key card, because it is the only element that names the finger without naming a key.
4. **Navigation stays during an attempt but dims** to `#A3AAA4`, with a mono note that it is muted until the attempt ends. Nothing is removed, so the TZ §9 demo routes never break.
5. **Zero-peek hides four things, not one:** the keyboard, the next key, the finger diagram and live speed and accuracy. Time, error count and progress stay visible — errors are feedback, not a secret.
6. **The error mark never moves the text.** Colour, tint and a 3 px underline appear in place on the awaited character; the caret does not advance (stop-on-letter). Shake and nudge are forbidden in the typing line.
7. **Finger colours are a new token group beyond the five «Serene Script» colours** — ink / tint / line per finger: pinky `#6B5B96` / `#EFEBF6` / `#CFC4E4`, ring `#316342` / `#E9F0EA` / `#BFD4C4`, middle `#8A6416` / `#F7EFDF` / `#E3CFA4`, index `#265C79` / `#E6EFF4` / `#B8D2DF`, thumbs `#5F6B63` / `#F2F4EE` / `#D9DCD6`. Used on the Path keyboard, the exercise keyboard and the finger strip. Keycap glyphs take the finger ink, so the colour never carries meaning alone.
8. **The dark palette is derived here**, because the pairs in `AGENTS.md` are token variants, not a dark theme: ground `#191C19`, surface `#232723`, hairlines `#333833` and `#3C423B`, text `#E8E8E0`, muted `#8E968D`, sage `#7FAE8B`, terracotta `#F08A63`, error tint `#3A2318`. Sage and terracotta lighten so both clear 4.5:1 on the dark ground.
9. **Low-vision preset:** white ground, 2 px ink borders, no shadows, no tinted fills, typing text 38 px at weight 600 with 0.04 em tracking, caret 4 px, the error as a 6 px double underline plus bold, keycaps 48 px with 2 px borders. It is a third theme, not a scale factor on the light one.
10. **Paper surface:** a 1 px `#E6E4DA` border plus a two-layer shadow (`0 1px 2px` at 4% and a wide `-20px` spread at 18%); 18 px radius on cards, 8 px on keycaps with a 2 px inset bottom bevel. That bevel is the whole "tactile" budget — no gradients anywhere.
11. **Result screen:** four metric tiles, the rhythm chart as hand-written SVG with intervals over 400 ms in terracotta, a named error list with per-error weight, then the one next action. **E5 is a deep sage card in the right column** with the new key on a cream keycap, its finger, the first words and one button to the words exercise — a card on the result, never a full-screen moment.
12. **Race room is one screen with five states** — gathering, 3-2-1, racing, validating, result. Validating is shown as real work with per-player rows, because that is where the replay check earns its trust. The accuracy floor rejection is visible in the result ("88%, below the 90% floor, not in the rating").
13. **Motion:** the rule "expressive frame, calm text" is made concrete as three layers — the typing line is CSS only and animates just the caret and the judged character; the frame uses View Transitions plus lazily loaded Motion; the race uses linear interpolation between broadcasts, forward only. One flag turns every duration token to `0.01ms`, skips the confetti import and disables sound; `prefers-reduced-motion` seeds it. Per-moment triggers, durations, easings and off-behaviour: [docs/design/motion.md](../../../docs/design/motion.md).
14. **Mockup copy is Ukrainian** and every exercise string in it obeys the unlock set (а о в л г ф і п р д ж), so the comps double as a check that Stage 1 content reads naturally under that constraint.

Resolved 2026-09-22. Nothing graduates from the fog: the package for `001-typing-core` was already ticket 23, which this unblocks.
