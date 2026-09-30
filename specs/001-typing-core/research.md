# Research: Typing Core (F1)

**Date**: 2026-09-30 · **Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Phase 0. Eight decisions: the three residuals ticket 11 recorded for this plan, and the five
functions and tables the spec depends on but does not define. Everything else was decided on the
wayfinder map and is not reopened here.

---

## R1. Router — TanStack Router with code-based routes

**Decision**: `@tanstack/react-router` 1.170.40, routes declared in code, no file-based routing and
no generated route tree.

**Rationale**: F1 runs seven worktrees — one Foundational, six story lanes — over one router. The
file-based mode's `routeTree.gen.ts` is a committed generated artifact that every lane adding a
route would rewrite, producing a conflict in a file nobody reviews and that regenerates differently
depending on which lane ran the generator last. Code-based routes put each route in the lane's own
feature directory and the route *registration* in one Foundational file, so a lane adds a route by
editing its own tree plus one line. The type-safety that motivated TanStack Router in research 03 —
typed params and typed search — survives intact in code-based mode; only the ergonomics of
discovery are lost, and with eleven routes that costs nothing.

**Alternatives considered**: *TanStack Router, file-based* — rejected for the generated-file
conflict above. *React Router 7* — viable and simpler, rejected because its params and search are
untyped, and search state is where the exercise mode (practice / test) and the session block index
live, which are exactly the values a typo would silently break. *No router, single-page state
machine* — rejected: TZ §9 demo steps are addresses, and jurors need to reach `/formulas` directly.

## R2. Styling — Tailwind CSS 4 with the tokens as CSS custom properties

**Decision**: `tailwindcss` 4.3.3. Every Serene Script value is a CSS custom property on `:root`,
and a theme is selected by a `data-theme` attribute on `<html>`, not by a class prefix.

**Rationale**: three themes — light (default), dark, and the low-vision preset — and ticket 20
settled that low-vision is a *third theme*, not a scale factor, so it redefines borders, shadows,
fills, tracking and sizes rather than multiplying them. With variant classes that is three class
names per styled element; with custom properties redefined under `[data-theme="dark"]` and
`[data-theme="low-vision"]`, it is one declaration block per theme and the component markup never
mentions a theme at all. It also gives the motion flag somewhere to live: one attribute flips every
duration token to `0.01ms`, which is what makes visual comparisons deterministic.

**Alternatives considered**: *Tailwind's `dark:` variant plus a third custom variant* — rejected
because the low-vision preset changes properties the variant system would have to duplicate across
every component. *Plain CSS modules* — rejected; Tailwind 4 was already assumed across `AGENTS.md`
and research 03, and abandoning it now is churn without a reason.

## R3. Toolchain versions

**Decision**, verified against the registry on 2026-09-30:

| Tool | Version | Note |
|---|---|---|
| Node | 24.19.0 | already on the machine |
| pnpm | current line, pinned in `packageManager` | **not installed** — Foundational establishes it via Corepack |
| TypeScript | 7.0.2 | see below |
| Vite | 8.3.1 | |
| React | 19.3.0 | |
| Vitest | 5.0.2 | |
| Playwright | 1.63.0 | |
| Tailwind | 4.3.3 | R2 |
| Zustand | 5.0.15 | plus hand-written typed reducers, not XState (ticket 11) |
| TanStack Router | 1.170.40 | R1 |
| TanStack Query | 5.104.0 | present for F2; F1 has no server to fetch from |
| Biome | 2.5.14 | lint and format, replacing ESLint and Prettier |
| Paraglide | 2.25.4 | uk / en interface |
| fast-check | 4.10.2 | the property tests principle II requires |
| axe-core/playwright | 4.13.0 | the zero-violation gate |

**TypeScript 7 rationale**: research 03 flagged that the 7.x line ships without the programmatic
compiler API, and asked whether that blocks us. It does not. Linting is Biome, which has its own
parser; type checking is `tsc --noEmit` through the CLI; Vite transpiles without type information.
Nothing in the stack above consumes the API. **Fallback, recorded now so it is not rediscovered
under pressure**: if any tool turns out to need it, drop to the latest 6.x line — the only source
change that implies is in `tsconfig`, because we use no 7-only syntax.

**Alternatives considered**: pinning the previous major of everything for safety — rejected, because
the project has no legacy to protect and a first commit on old majors is a migration scheduled for
later. The risk is bounded by the fallback above and by CI catching it on the Foundational PR.

---

## R4. Confidence, per key and per Transition

The spec requires Confidence "from recent timing and miss rate" (FR-029) and uses it in three
places: choosing the Focus Element, fading the keyboard guide across tiers (FR-060), and ranking the
Next Action (FR-032). Ticket 02 settled that we adopt keybr's *idea* of a confidence score and apply
it to Transitions, which no studied product does — clean-room, because keybr is AGPL.

**Decision**. For each element *e* (a Key or a Transition), fold the Attempt Aggregates in
completion order, maintaining four exponentially-weighted counters with a half-life of **10
observations** (decay `λ = 2^(−1/10) ≈ 0.933` applied to the running totals before each new
observation is added):

```
wHits, wMisses, wSumIki, wSumIkiSq

n              = wHits + wMisses
accuracyFactor = wHits / n
meanIki        = wSumIki / wHits                        -- correct keystrokes only
speedFactor    = clamp(REFERENCE_IKI / meanIki, 0, 1)
confidence(e)  = n < 5 ? undefined : accuracyFactor * speedFactor
```

`REFERENCE_IKI = 400 ms`, i.e. 150 characters per minute — the floor of the Basic band. Confidence
is `undefined`, not zero, below five observations, and `undefined` renders as the lowest guide tier.

**Rationale**:

- *Exponential weighting rather than a fixed window* — it is a fold, so it composes with FR-050
  (progress is a fold over aggregates in completion order) and needs no history buffer; and it has
  no cliff where the twentieth-oldest attempt suddenly stops counting.
- *A product of two factors, not a sum* — an element typed accurately but very slowly is not
  confident, and neither is a fast element typed wrongly. A weighted sum would let one factor mask
  the other, which is exactly the failure the guide-fade must not make.
- *`undefined` below five observations* — a key the learner has never pressed is not "0% confident",
  it is unmeasured, and the two must render the same way (full finger colour plus the attention ring)
  while remaining distinguishable in the data and in the Next Action, which must never name an
  element with too few samples (FR-035).
- *Timing from correct keystrokes only* — the interval before a wrong key measures hesitation, which
  the miss already counts; including it would penalise the same event twice.

**Confidence never gates anything.** It picks what to practise and how much guide to show. Mastery
depends on accuracy alone (FR-039) and speed never gates progression (FR-040), so the presence of a
speed term inside Confidence does not smuggle a speed gate into progression. This sentence belongs
on the Formulas page.

**Property tests** (fast-check, per principle II): the result is `undefined` or within `[0, 1]`;
adding a hit never lowers it; adding a miss never raises it; a shorter interval never lowers it;
the same aggregate sequence always yields the same value. Order-dependence is intended and stated —
recency is the point — so no commutativity property is asserted.

**Alternatives considered**: *a plain rolling hit rate* — rejected, it ignores timing, and a key
typed correctly but with a half-second hunt is the single most common Stage 1 failure.
*Bayesian smoothing with a prior* — rejected, it invents a confidence value for an unseen key, which
is the thing the `undefined` rule exists to prevent.

## R5. Rhythm Consistency

`CONTEXT.md` defines it as the standard deviation of inter-keystroke intervals normalised to a
percentage where 100% is a perfect metronome, and leaves "normalised how" open.

**Decision**. Over the eligible intervals of one attempt:

```
cv                  = stdev(iki) / mean(iki)           -- coefficient of variation
rhythmConsistency   = 100 * max(0, 1 - cv)
```

**Eligible intervals**: between two consecutive correct keystrokes only. Excluded — the interval
before the first keystroke; any interval spanning a wrong keystroke or a Backspace; any interval
while the tab did not have focus; and any interval above **3000 ms**, which is treated as the
learner taking a break. The number of excluded breaks is reported alongside the figure, so a
suspiciously smooth score cannot hide behind silent exclusions.

**Rationale**: raw standard deviation is not comparable between a slow learner and a fast one — 80 ms
of jitter is ragged at 600 ms per keystroke and catastrophic at 120 ms. The coefficient of variation
is scale-free, which is the only reading of "normalised" that makes the number mean the same thing
across the whole level table. `cv = 0` gives 100%; `cv ≥ 1`, where the spread equals the mean, gives
0% and is genuinely arrhythmic. The 3000 ms break rule exists because without it one interruption
drives the figure to zero and the metric stops being about rhythm.

**Alternatives considered**: *normalising by a fixed reference deviation* — rejected, it is the raw
standard deviation with extra steps and inherits the same incomparability. *The median absolute
deviation over the median* — more robust, rejected because ticket 20 already renders intervals over
400 ms in terracotta, so outliers are *shown* rather than smoothed, and the headline number should
agree with what the chart displays.

## R6. Generating the eight Stage 1 scale types from a finger map

FR-009 forbids hand-written scale text: the same scale type must produce correct text in both
layouts, from the layout's finger map. FR-012 restricts the characters to the unlocked set plus the
scale's Focus Element. So a Scale is not text — it is **(generator, unlocked set, seed) → text**, and
the Scale Catalogue holds authored metadata over generators.

**Decision**: eight generators, mapping one-to-one onto the eight mandatory types.

| Generator | Rule | QWERTY sample | ЙЦУКЕН sample |
|---|---|---|---|
| `run` | Home-row anchors in order, left to right, then right to left, in groups of four | `asdf jkl; ;lkj fdsa` | `фіва олдж ждло авіф` |
| `mirror` | The same-named finger of each hand paired, edges to centre, then back out | `a; sl dk fj fj dk sl a;` | `фж ід вл ао ао вл ід фж` |
| `alternate` | Hands alternate without pairing the same finger: left fingers outward-in against right fingers inward-out | `aj sk dl f;` | `фо іл вд аж` |
| `fingerIsolation` | One finger rank at a time, both hands, repeated | `a; a; a; / sl sl sl` | `фж фж фж / ід ід ід` |
| `vertical` | Each home key paired with the key above it on the same finger, then with the key below | `aq sw de fr ju ki lo` then `az sx dc fv jm` | `фй іц ву ак ог лш` then `фя іч вс ам оь` |
| `fingerSpan` | One finger across every key assigned to it, digraph by digraph — this is where the index fingers' six keys live | `frv ftg fb` | `акм аеи ак` |
| `modifiers` | Space, Shift with the opposite-hand pinky, digits, and punctuation, each as its own sub-variant | `Fa Ja / 1a 2s / a, a. a;` | `Фа Оа / 1а 2в / а, а. а;` |
| `tempo` | One short motif from the unlocked set, repeated against a metronome target that steps up across the exercise | motif at 100 → 120 → 140 SPM | same |

Every generator takes the unlocked set and emits only characters in it, plus the Focus Element; when
the unlocked set cannot satisfy a generator — `vertical` before any top-row key is unlocked — the
generator yields nothing and the Scale is not offered, rather than silently degrading.

**Rationale**: the eight rows are the eight bullets of the requirements' Stage 1 list, in their
order, so coverage is checkable by inspection rather than argument. `fingerIsolation` and
`fingerSpan` look similar and are not: the first drills the *same finger on both hands*, which is
the requirements' "isolation of same-named fingers"; the second drills *one finger over its own
several keys*, which is a separate bullet and the only place the index fingers' six-key spans get
exercised. Keeping them apart is what makes the catalogue provably cover the list.

**Determinism**: every generator is a pure function of (finger map, unlocked set, seed, size). The
seed comes from the Random seam, so an end-to-end test always sees the same text.

**Alternatives considered**: *authoring the scale text per layout* — rejected by FR-009 and because
the text must follow the unlocked set, which authoring cannot. *One generator parameterised by a
type flag* — rejected: a single function with eight branches hides the coverage argument that makes
this table auditable.

## R7. Unlock Order

**Decision**: the order is generated from the finger map by a stated rule, not authored, and then
frozen per layout and verified by test.

**The initial set** is the eight home-row anchors plus the space bar — `ASDF JKL;` and
`ФІВА ОЛДЖ`. These are never "unlocked"; they are present from the first exercise, because the first
mandatory scale type is the home-row run and it needs all eight at once. Unlocking therefore begins
at the ninth key.

**The rule**, applied in order:

1. the remaining **home-row letters**, by finger rank index → middle → ring → pinky, left hand
   before right within a rank. QWERTY: `G H`. ЙЦУКЕН: `П Р`, then `Є`.
2. the **top row**, same finger order. QWERTY: `R T Y U`, `E I`, `W O`, `Q P`. ЙЦУКЕН:
   `К Е Н Г`, `У Ш`, `Ц Щ`, `Й З Х Ї`.
3. the **bottom row**, same finger order. QWERTY: `V B N M`, `C`, `X`, `Z`. ЙЦУКЕН: `М И Т Ь`,
   `С Б`, `Ч Ю`, `Я`.
4. **Shift and capitals**, then the **digits** `1`…`0` on the classic assignment, then
   **punctuation** — `. , ; : - ' "` — and for Ukrainian **`Ґ`** on the backslash key.

Non-letter keys are deliberately last, which is why QWERTY's `'` and `.` do not ride along with the
home and bottom rows they physically sit on: they are punctuation, and the requirements train
punctuation as its own movement.

**Rationale**: an authored list is a thing to get wrong twice, once per layout. A rule plus a frozen
derived list is checkable: the tests assert that the derived list covers every supported key exactly
once, that each key resolves to exactly one finger (SC-004), and that any learner's unlocked set is a
prefix of it (FR-042). The finger ranks come from ticket 10 and the requirements' §2 tables; the
extensions ticket 10 added — apostrophe on the left pinky, `Ґ` on the backslash key as right pinky,
hyphen right pinky, classic digits — enter at step 4.

**Alternatives considered**: *frequency-ordered unlocking* — unlocking the most common letters
first. Rejected: it breaks the finger-rank progression the requirements' §2 mandates and would mean
a learner's third key is on a row they have never reached. Frequency governs *word* selection in F3,
not key order.

## R8. Measuring keystroke-to-paint

FR-070 and SC-002 require p95 ≤ 16 ms, and principle IV calls latency a correctness property. The
open question is how to measure it so the gate means something.

**Decision — two instruments, different jobs.**

*The CI gate* is in-page instrumentation, in its own Playwright project, Chromium only, launched
with frame-rate limiting and GPU vsync disabled. For each of 200 keystrokes driven through the
text-input path: record `t0` on entry to the `beforeinput` handler; inside the next animation frame
schedule a macrotask; record `t1` when that task runs. Report the p95 of `t1 − t0`. A regression
fails the build.

*Diagnosis*, when the gate fires, is a CDP trace — `performance_start_trace` from the
`chrome-devtools` MCP server in development, or a `Tracing` session over Playwright's CDP connection
in CI — read for the dispatch-to-commit chain of the slow keystrokes.

**Rationale**: `t1 − t0` measured this way is an **upper bound** on true keystroke-to-paint, because
the macrotask after the frame runs strictly later than the commit. That makes the gate conservative:
it can fail on a frame that actually made it, and it cannot pass one that did not. For a regression
gate, erring toward strictness is correct, and the alternative — a number that flatters us — is
worse than no gate. The Event Timing API was the obvious candidate and is unusable here: its
durations are rounded to 8 ms, which is half the budget.

**Alternatives considered**: *Event Timing API* — rejected, 8 ms granularity against a 16 ms budget.
*CDP trace as the gate itself* — rejected for CI: trace parsing is brittle across Chromium versions
and turns a red build into an archaeology exercise; it is the right tool once a human is already
looking. *`requestAnimationFrame` alone, without the following task* — rejected, it measures up to
the frame callback, which runs before paint, and would under-report.

---

## Consequences for the plan

- `packages/metrics` owns R4 and R5, is free of browser and Node APIs, and is therefore importable
  unchanged by F2's Edge Functions (ADR-0007).
- `packages/curriculum` owns R6 and R7 under the same constraint.
- R8 needs one test-only instrumentation hook in the app, gated so it ships dead in production, plus
  its own Playwright project. Both belong to the Foundational phase.
- R1, R2 and R3 are all hot files. All three land in the Foundational phase and in no story lane.
- Before writing code against any of the libraries in R3, run
  `MSYS_NO_PATHCONV=1 ctx7 docs <libraryId> "<query>"` first (`AGENTS.md`). The versions above are
  recent majors and recalled API shapes are the likeliest source of wasted effort.
