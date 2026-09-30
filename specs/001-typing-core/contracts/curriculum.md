# Contract: `packages/curriculum`

**Owner**: Foundational phase · **Spec**: [../spec.md](../spec.md) · **Rules**:
[../research.md R6, R7](../research.md#r6-generating-the-eight-stage-1-scale-types-from-a-finger-map)

The curriculum: layouts and finger maps, the Unlock Order, the eight scale generators, the level
table, the progress fold, and the Next Action rules. **No browser API, no Node API**, for the same
reason as `metrics` — F2's Edge Function imports it to validate that an attempt's text was legitimate.

Five sub-surfaces, each its own directory, because the file-ownership table
([plan.md](../plan.md#file-ownership)) splits this package across the Foundational phase only and the
boundaries must be legible.

## `layout` — Layout, Key, Transition, Unlock Order

```ts
export const layouts: Record<'yq' | 'qwerty', Layout>

export function fingerOf(layout: Layout, char: string): { hand: Hand; finger: Finger } | undefined
export function transitionOf(layout: Layout, from: string, to: string): Transition
export function initialUnlockedSet(layout: Layout): string[]      // the 8 anchors + space
export function nextLockedKey(layout: Layout, unlocked: string[]): string | undefined
```

Guarantees: every supported character resolves to **exactly one** finger (FR-002, SC-004); `ґ`, the
apostrophe, the hyphen and the digits are in the table, not special-cased in code (FR-003);
`unlockOrder` covers every unlockable key exactly once and `nextLockedKey` walks it, so any unlocked
set is a prefix (FR-042).

## `scales` — the eight generators and the Catalogue

```ts
export const catalogue: Record<'yq' | 'qwerty', Scale[]>

export function generateText(args: {
  scale: Scale
  layout: Layout
  unlocked: string[]
  random: Random
}): string | 'requirements-unmet'
```

Guarantees: text contains only unlocked characters plus `scale.focus.value` (FR-012); the Focus
Element appears in **every item** (FR-046); `'requirements-unmet'` is returned rather than degraded
text when the unlocked set cannot serve the generator, and such a Scale is not offered; identical
`(scale, unlocked, seed)` always gives identical text; no text comes from a dictionary (FR-013). All
eight generator types are present for both layouts (SC-003).

## `levels` — the level table

```ts
export const levels: Level[]
export function levelFor(stage: 1, progress: Progress): Level      // always `introduction` in F1
export function passes(accuracy: number, level: Level): boolean
```

`levelFor` takes the **stage**, not the speed: the level follows the stage (FR-080), so no gain in
speed raises the accuracy floor, and F1's Mastery threshold is one value, 95%.

## `progress` — the fold, the Mastery Rule, the unlock rule

```ts
/** The single source of derived state. Same history in, same progress out (FR-050). */
export function deriveProgress(args: {
  attempts: AttemptSummary[]                // ordered by completedAt
  layout: Layout
  startingLevelChoice: StartingLevelChoice
}): Progress

export function retentionPlan(attempts: AttemptSummary[]): { keepLogsFor: string[] }
```

Guarantees: three consecutive **Test** Attempts at or above the floor satisfy the Mastery Rule; a
failing attempt resets the count; a Practice Attempt never counts (FR-039). Speed never appears in
this function (FR-040). A key unlocks only when mastery is met on a Scale whose Focus Element is that
key (FR-041), and the resulting set is always a prefix of `unlockOrder` (FR-042).
`startingLevelChoice` may only move the boundary forward (FR-073). Stage 1 completes at every scale
done plus 96% over the last five attempts (FR-044). `retentionPlan` names the 20 attempts whose logs
are kept (FR-081), and discarding the rest changes nothing this function returns (SC-019).

## `coach` — the Next Action

```ts
/** Exactly one, chosen by the first matching rule of four (FR-031, FR-032). */
export function nextAction(args: {
  progress: Progress
  lastAttempt: AttemptSummary | null
  layout: Layout
  catalogue: Scale[]
}): NextAction
```

Guarantees: the return type is a single value, never a list and never null — "exactly one, never zero,
never two" (SC-010) is enforced by the type, not by a check. Priority order is strict and first match
wins: accuracy below the floor → the worst-timing Transition with enough samples → uneven rhythm with
acceptable accuracy → the next key. A Transition below `CONFIDENCE_MIN_SAMPLES` is never named
(FR-035). Same-finger Transitions carry extra weight for Ukrainian (FR-033). The result is a template
key plus substituted values, never a formatted string, so the exact sentence is unit-testable and
translatable (FR-034).

## Hidden inside

The finger-map tables themselves, the per-generator text assembly, the decay and prefix bookkeeping in
the fold, and the weighting constants in the coach. Callers get data and decisions, never the tables.

## Test obligations

Table tests over both layouts for the one-finger invariant and Unlock Order coverage. Property tests:
generated text never contains a locked character; the derived unlocked set is always a prefix of
`unlockOrder`; `deriveProgress` is a pure function of its ordered input; no sequence of attempts,
however fast, unlocks a key without three consecutive passes (SC-009); `nextAction` returns exactly
one result for every reachable progress state.
