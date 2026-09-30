# Contract: `packages/engine`

**Owner**: `[US1]` · **Spec**: [../spec.md](../spec.md) · **Depends on**: `Clock`, `InputSource`,
`packages/curriculum` layout data

The keystroke state machine. The only package that knows input exists. It consumes `InputEvent`s and
produces a `KeystrokeEventLog` plus the minimum state a view needs to render — and nothing else: it
computes no metric, because metrics must also be computable on a server from a stored log
([ADR-0007](../../../docs/adr/0007-server-recomputes-metrics-with-shared-packages.md)).

## Surface

```ts
export type AttemptState = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned'

export interface EngineView {
  readonly state: AttemptState
  /** Index of the awaited character in `text`. */
  readonly cursor: number
  /** Set when the last keystroke was wrong and the caret is held (FR-016, FR-017). */
  readonly markedAt: number | null
  readonly errorCount: number
  readonly elapsedMs: number
  readonly lastError: { expected: string; got: string; at: number } | null
}

export interface Engine {
  readonly view: EngineView
  /** Fires once per processed event. The typing line is the only subscriber that repaints (FR-069). */
  onChange(listener: (view: EngineView) => void): () => void
  start(): void
  pause(): void
  resume(): void
  abandon(): void
  /** Only after `completed`. Throws otherwise — an unfinished attempt has no log (spec edge case). */
  finish(): KeystrokeEventLog
}

export function createEngine(options: {
  text: string
  errorMode: 'stopOnLetter' | 'freeBackspace'
  input: InputSource
  clock: Clock
  layout: Layout
}): Engine
```

## Behaviour this contract guarantees

- The attempt begins on the first printable character, or on `start()` (FR-014).
- A wrong keystroke never becomes the correct character. `markedAt` is set, `cursor` does not move
  under `stopOnLetter`, and `errorCount` rises (FR-016, FR-017).
- Backspace clears the mark and may move `cursor` back, and **never lowers `errorCount`** (FR-024).
  It never walks behind index 0.
- `ignored` events advance nothing and count nothing (FR-020), and are still written to the log.
- `pause()` and an unfocused tab both stop `elapsedMs` advancing; neither restarts the attempt.
- The apostrophe folds: U+0027 and U+2019 judge each other as correct (FR-007).
- `і`, `ї`, `є`, `ґ` are judged as themselves, never substituted (FR-006).
- A composition event replacing several characters is judged character by character in order, never
  skipping one (spec edge case).
- `onChange` fires once per event; the view carries no metric, so a repaint cannot touch anything
  outside the typing line (FR-069).

## Hidden inside

Hidden textarea reconciliation is not here — it is behind `InputSource`. What `engine` itself hides:
the cursor/mark state machine's transition table, backspace depth bookkeeping, the focus-loss timer
accounting, apostrophe folding, and log encoding into parallel arrays. None of it is exported.

## Test obligations

Property tests (fast-check): `errorCount` is monotonically non-decreasing across any event sequence;
`cursor` stays within `[0, text.length]`; typing `text` exactly yields `errorCount === 0` and
`completed`; inserting any number of `ignored` events into a correct sequence changes no field but
the log length; under `stopOnLetter`, `cursor` never advances while `markedAt` is set. Example tests
cover each edge case listed in the spec.
