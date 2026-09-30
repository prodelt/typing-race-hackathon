# Data Model: Typing Core (F1)

**Date**: 2026-09-30 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

F1 has no server and no database. This is the in-browser model: what is computed, what is stored,
and what the shapes must guarantee. The `Layout`, `Scale` and `Level` groups are **static data
generated at build time and shipped with the app**; the `Attempt` and `Progress` groups are **learner
state written at runtime** behind the `ProgressStore` seam. Which group a thing belongs to decides
whether it needs a version marker and whether it can be regenerated.

Terms are the ones in [`CONTEXT.md`](../../CONTEXT.md). Five of them — Layout, Key, Scale, Level,
Settings — are used here as first-class entities and are not yet in the glossary; adding them is a
Foundational task.

---

## Static data — generated, shipped, never written at runtime

### Layout

One per keyboard layout. Two instances: `yq` (Ukrainian ЙЦУКЕН) and `qwerty`.

| Field | Type | Notes |
|---|---|---|
| `id` | `'yq' \| 'qwerty'` | |
| `language` | `'uk' \| 'en'` | the typing language this layout serves |
| `keys` | `Key[]` | every supported key, exactly once |
| `homeAnchors` | `string[]` | the eight anchor characters — `ФІВА ОЛДЖ` / `ASDF JKL;` |
| `unlockOrder` | `string[]` | derived by the rule in [research R7](./research.md#r7-unlock-order), then frozen |

**Invariants**, each a test (SC-004, FR-002, FR-042):

- every character produced by any key resolves to **exactly one** finger — none unassigned, none twice;
- `unlockOrder` contains every unlockable key exactly once and no anchor;
- `homeAnchors` has length 8 and every anchor is on the home row;
- the space bar is assigned to the thumbs and is in neither `unlockOrder` nor `homeAnchors` — it is
  present from the first exercise;
- Ukrainian `і`, `ї`, `є`, `ґ` appear in `keys` as themselves (FR-006).

### Key

| Field | Type | Notes |
|---|---|---|
| `code` | `string` | the physical key, layout-independent (`KeyA`, `Backslash`) |
| `row` | `'top' \| 'home' \| 'bottom' \| 'digit'` | |
| `hand` | `'left' \| 'right' \| 'thumbs'` | |
| `finger` | `'pinky' \| 'ring' \| 'middle' \| 'index' \| 'thumb'` | exactly one — FR-002 |
| `plain` | `string` | the character produced unshifted |
| `shifted` | `string \| null` | the character produced with Shift |
| `kind` | `'letter' \| 'digit' \| 'punctuation' \| 'space' \| 'modifier'` | drives the Unlock Order's step 4 |

`ґ` sits on `Backslash` and `'` on the key left of `Digit1`, both from ticket 10; macOS positions for
those two are verified against a real machine before release and corrected in this data, not in code.

### Transition

Derived, never stored. Computed from an ordered character pair plus a Layout.

| Field | Type |
|---|---|
| `from`, `to` | `string` — the two characters |
| `fromFinger`, `toFinger` | finger plus hand |
| `rowChange` | `boolean` |
| `sameFinger` | `boolean` — both characters on one finger |

`sameFinger` is the field the Next Action weights up for Ukrainian (FR-033), because ЙЦУКЕН produces
18.58% same-finger transitions against QWERTY's 5.80% (ticket 08).

### Scale and Scale Catalogue

A Scale is not text. It is authored metadata over one of the eight generators in
[research R6](./research.md#r6-generating-the-eight-stage-1-scale-types-from-a-finger-map); its text
is produced by `(generator, unlockedSet, seed, size)`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | stable, referenced by Attempts forever |
| `layoutId` | Layout id | |
| `type` | one of the eight generator names | `run`, `mirror`, `alternate`, `fingerIsolation`, `vertical`, `fingerSpan`, `modifiers`, `tempo` |
| `focus` | `{ kind: 'key' \| 'transition', value: string }` | the Focus Element, present in every item — FR-046 |
| `fingers` | finger list | what it exercises |
| `size` | `number` | target character count |
| `targetSpm` | `number \| null` | only `tempo` sets it, as a step series |
| `goal` | message key | the one stated goal the learner reads — FR-010 |
| `requires` | `string[]` | characters beyond the anchors the generator needs |

**Invariants**: generated text contains only characters in the unlocked set plus `focus.value`
(FR-012); a Scale whose `requires` the unlocked set cannot satisfy yields **nothing and is not
offered**, rather than degrading silently; text never comes from a dictionary (FR-013); the same
`(id, unlockedSet, seed)` always produces identical text.

The **Scale Catalogue** is the set of Scales for one Layout, ordered against `unlockOrder`. Its
invariant is coverage: all eight generator types appear for both layouts (SC-003).

### Level

The requirements' level table, as data so it can change without touching behaviour (FR-030).

| Field | Type | Introduction band |
|---|---|---|
| `id` | `string` | `introduction` |
| `spmBenchmark` | `{min, max} \| null` | `null` — no speed requirement |
| `accuracyFloor` | `number` | `0.95` |
| `goal` | message key | correct finger and return to the home row |

Bands beyond Introduction — 96% / 97% / 97% / 98% — exist in the data and on the Formulas page so F3
and F4 inherit them rather than invent them. **In F1 only Introduction is ever in force**, because
the level follows the stage (FR-080), so the Mastery Rule's threshold in F1 is one value: 95%.

---

## Runtime state — written behind `ProgressStore`, version-marked

### Attempt

One run of one Scale. Immutable once completed.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | client-generated UUID — the same shape F2's idempotent outbox needs |
| `scaleId` | `string` | |
| `layoutId`, `language` | | |
| `mode` | `'practice' \| 'test'` | only `test` counts toward mastery — FR-039 |
| `text` | `string` | the exact generated text, kept so a result can be re-read |
| `seed` | `number` | reproduces `text` |
| `startedAt`, `completedAt` | epoch ms | |
| `elapsedMs` | `number` | excludes time the tab spent unfocused |
| `metrics` | `AttemptMetrics` | see below |
| `aggregates` | `AttemptAggregates` | kept forever |
| `log` | `KeystrokeEventLog \| null` | `null` once pruned — FR-081 |

**State transitions**: `idle → running → (paused ⇄ running) → completed`. `running → abandoned`
produces no Attempt at all: no metrics, no aggregates, no effect on the Mastery Rule. `paused` is
entered by Escape (FR-022) and by a layout mismatch mid-attempt; the clock does not advance in
`paused` or while the tab is unfocused.

### KeystrokeEventLog

Append-only, one entry per keystroke, including wrong keystrokes and Backspaces (FR-019). Stored as
parallel arrays with millisecond deltas — the same compact shape ticket 21 fixed for the server, so
F2 changes nothing:

| Field | Type |
|---|---|
| `formatVersion` | `number` |
| `dt` | `number[]` — ms since the previous event |
| `kind` | `('char' \| 'backspace' \| 'ignored')[]` |
| `char` | `(string \| null)[]` |
| `correct` | `boolean[]` |

`ignored` records a modifier, input-method or dead-key event that consumed no awaited character and
counted no error (FR-020) — recorded so that "it did not break the session" is provable rather than
asserted.

**Retention**: kept for the **20 most recent attempts** only. Pruning an older log changes no metric,
no confidence value, no history entry and no unlocked key (FR-081, SC-019). A result screen for an
attempt whose log is gone still shows its metrics from `aggregates`, and says plainly that the
keystroke-level detail is no longer kept.

### AttemptMetrics

All derived from the log, never accumulated as the learner types (FR-019). Formulas in
[research R4, R5](./research.md#r4-confidence-per-key-and-per-transition) and on the Formulas page.

| Field | Notes |
|---|---|
| `spm` | primary — characters per minute |
| `wpm` | `spm / 5`, secondary, formula published |
| `accuracy` | correct character keystrokes / all character keystrokes. A wrong keystroke stays in numerator's complement and in the denominator after a Backspace correction; Backspace is **not** in the denominator — FR-024 |
| `errorCount` | total wrong character keystrokes, corrected or not |
| `errorsByChar` | `Record<string, number>` |
| `rhythmConsistency` | R5; carries `breaksExcluded` so a flattering figure cannot hide exclusions |
| `meanIkiByKey`, `meanIkiByTransition` | FR-026 |

### AttemptAggregates

The per-key and per-transition summary. **The only input to progress and Confidence** (FR-028), and
kept forever, which is what makes the retention rule safe.

```
keys:        Record<char,      { count, misses, sumIki, sumIkiSq }>
transitions: Record<"a>b",     { count, misses, sumIki, sumIkiSq }>
```

Sum and sum-of-squares rather than a list of intervals: it is the smallest form from which mean and
standard deviation are both recoverable, and it folds.

### Progress

Not stored as a truth of its own — **derived by folding `AttemptAggregates` in `completedAt` order**
(FR-050), so the same history always yields the same progress and out-of-order arrivals in F2 stay
correct.

| Field | Type | Notes |
|---|---|---|
| `derivedVersion` | `number` | bumped when the fold changes, so a stale snapshot is detectable |
| `language` | `'uk' \| 'en'` | **one Progress per language** — FR-051 |
| `unlockedSet` | `string[]` | always a prefix of `unlockOrder` — FR-042 |
| `consecutivePasses` | `Record<scaleId, number>` | Test Attempts only; a failing attempt resets to 0 |
| `completedScales` | `scaleId[]` | |
| `keyConfidence` | `Record<char, number \| undefined>` | R4; `undefined` below five observations |
| `transitionConfidence` | `Record<"a>b", number \| undefined>` | R4 |
| `stage` | `{ current: 1, stage1Complete: boolean }` | complete when every scale is done and accuracy over the last five attempts ≥ 96% — FR-044 |
| `startingLevelChoice` | one of three | FR-048; may only move the unlocked boundary forward — FR-073 |
| `history` | `AttemptSummary[]` | one entry per attempt, forever |

### Settings

| Field | Values | Default |
|---|---|---|
| `theme` | `system \| light \| dark \| lowVision` | `light` |
| `motion` | `system \| reduced \| off` | `system`, seeded by `prefers-reduced-motion` — FR-064 |
| `sound` | `on \| off` | `off` — FR-064, and the spec's scenario that no sound plays at defaults |
| `textSizePx` | 24–40 | 28 |
| `errorMode` | `stopOnLetter \| freeBackspace` | `stopOnLetter` — Stage 1, ticket 10 |
| `typingLanguage` | `uk \| en` | `uk` |
| `layoutId` | `yq \| qwerty` | follows `typingLanguage` |
| `interfaceLanguage` | `uk \| en` | `uk` |

### NextAction

Derived, never stored. Exactly one at a time (FR-031), chosen by the first matching rule of four
(FR-032).

| Field | Type |
|---|---|
| `rule` | `'lowerTempo' \| 'weakTransition' \| 'evenRhythm' \| 'nextKey'` |
| `template` | message key |
| `values` | `Record<string, string \| number>` — substituted into the template, so the exact sentence is testable (FR-034) |
| `startsScaleId` | `string` — the button's target |

---

## The stored envelope

Everything under **Runtime state** is written as one version-marked envelope (FR-082, FR-083):

```
{ storeVersion: 1, writtenAt, progressByLanguage, settings, attempts, logs }
```

- `storeVersion` is explicit and the format is documented here, so **F2 can decide whether to import
  it**. F1 contains no migration code.
- A `storeVersion` the running app does not recognise is **never read as if it were current**: the
  learner is told and offered a deliberate fresh start (FR-083).
- When the browser cannot keep local data at all, the learner is told plainly and the current visit's
  practice still runs (FR-052).
- Concurrent tabs must not let stale state silently win (spec edge case). The envelope carries
  `writtenAt`, and the resolution rule is a Foundational task; the requirement is only that a
  silent overwrite is impossible.
