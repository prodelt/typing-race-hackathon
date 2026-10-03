/**
 * The shared domain types of Typing-Race.
 *
 * This package holds **types only** and emits no runtime code. It exists because `metrics` needs a
 * `Layout` and `curriculum` needs `AttemptAggregates`, which would otherwise be a package cycle.
 * Putting the nouns both packages speak in one place also means the parallel work on `metrics`,
 * `curriculum` and `engine` agrees on them by construction rather than by review.
 *
 * Every field here is specified in `specs/001-typing-core/data-model.md`. When the two disagree,
 * the data model is right and this file is the bug.
 *
 * No browser and no Node APIs, so F2's Edge Functions import it unchanged (ADR-0007).
 */

// ---------------------------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------------------------

export type LayoutId = 'yq' | 'qwerty'
export type Language = 'uk' | 'en'

// ---------------------------------------------------------------------------------------------
// Layout, Key, Transition — static data, generated and shipped, never written at runtime
// ---------------------------------------------------------------------------------------------

export type Hand = 'left' | 'right' | 'thumbs'
export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb'
export type Row = 'top' | 'home' | 'bottom' | 'digit'
export type KeyKind = 'letter' | 'digit' | 'punctuation' | 'space' | 'modifier'

/** Which finger types a character. Exactly one, always — FR-002, SC-004. */
export interface FingerAssignment {
  readonly hand: Hand
  readonly finger: Finger
}

/** One physical key. The character it produces is a *property* of the key, not its identity. */
export interface Key {
  /** The physical key, layout-independent: `KeyA`, `Backslash`, `Space`. */
  readonly code: string
  readonly row: Row
  readonly hand: Hand
  readonly finger: Finger
  /** The character produced unshifted. */
  readonly plain: string
  /** The character produced with Shift, or `null` when the key produces none. */
  readonly shifted: string | null
  readonly kind: KeyKind
}

export interface Layout {
  readonly id: LayoutId
  /** The typing language this layout serves. */
  readonly language: Language
  /** Every supported key, exactly once. */
  readonly keys: readonly Key[]
  /** The eight anchor characters — `ФІВА ОЛДЖ` / `ASDF JKL;`. Unlocked from the very first exercise. */
  readonly homeAnchors: readonly string[]
  /**
   * The fixed sequence in which keys unlock, derived by research R7 and then frozen. Every
   * unlockable character exactly once; no anchor and no space. A learner's unlocked set is always
   * a prefix of this — FR-042.
   */
  readonly unlockOrder: readonly string[]
}

/**
 * The motor move from one character to the next. Derived from an ordered pair plus a Layout, never
 * stored. A bigram is the character pair in text; a Transition is the movement that types it.
 */
export interface Transition {
  readonly from: string
  readonly to: string
  readonly fromFinger: FingerAssignment
  readonly toFinger: FingerAssignment
  readonly rowChange: boolean
  /**
   * Both characters on one finger. This is the field the Next Action weights up for Ukrainian
   * (FR-033): ЙЦУКЕН produces 18.58% same-finger transitions against QWERTY's 5.80% (ticket 08).
   */
  readonly sameFinger: boolean
}

/** The canonical key of a Transition inside an aggregate: `"а>б"`. Built by `transitionKey`. */
export type TransitionKey = string

// ---------------------------------------------------------------------------------------------
// Scale — authored Stage 1 metadata. A Scale is not text.
// ---------------------------------------------------------------------------------------------

export type ScaleType =
  | 'run'
  | 'mirror'
  | 'alternate'
  | 'fingerIsolation'
  | 'vertical'
  | 'fingerSpan'
  | 'modifiers'
  | 'tempo'

/** The weakest element an exercise is built around; it appears in **every item** — FR-046. */
export interface FocusElement {
  readonly kind: 'key' | 'transition'
  /** A single character for `key`; a `"a>b"` transition key for `transition`. */
  readonly value: string
}

export interface Scale {
  /** Stable. Attempts reference it forever, so it never changes meaning. */
  readonly id: string
  readonly layoutId: LayoutId
  readonly type: ScaleType
  readonly focus: FocusElement
  /** What this scale exercises. */
  readonly fingers: readonly FingerAssignment[]
  /** Target character count of the generated text. */
  readonly size: number
  /** Only `tempo` sets one, as a step series; every other type leaves it `null`. */
  readonly targetSpm: number | null
  /** Message key for the one stated goal the learner reads before starting — FR-010. */
  readonly goal: string
  /** Characters beyond the home anchors the generator needs before it can produce text. */
  readonly requires: readonly string[]
}

// ---------------------------------------------------------------------------------------------
// Word Drill — authored Stage 2 metadata. Like a Scale, a Word Drill is not text: its words are
// drawn from the Word Bank at plan time, from the learner's unlocked set only.
// ---------------------------------------------------------------------------------------------

/**
 * What one Stage 2 drill trains, after the requirements' §3.2 list. `focus` is the drill a Next
 * Action builds around one weak key or transition; it is not in any catalogue, its id carries its
 * Focus Element.
 */
export type WordDrillKind =
  | 'firstWords'
  | 'newKey'
  | 'length'
  | 'repeat'
  | 'sameFinger'
  | 'alternation'
  | 'apostrophe'
  | 'hyphen'
  | 'capitals'
  | 'ukLetter'
  | 'weak'
  | 'focus'

export interface WordDrill {
  /** Stable. Attempts reference it through `Attempt.scaleId` forever. */
  readonly id: string
  readonly layoutId: LayoutId
  readonly kind: WordDrillKind
  /** The key or transition every word contains, or `null` for a drill over a whole property. */
  readonly focus: FocusElement | null
  /** For `length`: the inclusive word-length band. */
  readonly lengths: { readonly min: number; readonly max: number } | null
  /** Characters (and the Shift token) that must be unlocked before the drill opens. */
  readonly requires: readonly string[]
  /** A drill that must be complete first — how the length ladder goes short, medium, long. */
  readonly after: string | null
  /** Target character count of the generated text. */
  readonly size: number
}

// ---------------------------------------------------------------------------------------------
// Level — the requirements' level table, as data
// ---------------------------------------------------------------------------------------------

export interface Level {
  readonly id: string
  /** The band's name in each interface language, straight from the level config. */
  readonly name: Readonly<Record<Language, string>>
  /**
   * `null` in the Introduction band: no speed benchmark. `max: null` is an open-ended top band
   * ("300+"). A benchmark only — speed never gates mastery.
   */
  readonly spmBenchmark: { readonly min: number; readonly max: number | null } | null
  /** A fraction in [0, 1]. Introduction is `0.95`. */
  readonly accuracyFloor: number
  /** The band's main goal in each interface language. */
  readonly goal: Readonly<Record<Language, string>>
}

// ---------------------------------------------------------------------------------------------
// Keystroke log, metrics and aggregates
// ---------------------------------------------------------------------------------------------

export type KeystrokeKind = 'char' | 'backspace' | 'ignored'

/**
 * Append-only, one entry per keystroke including wrong ones and Backspaces (FR-019). Parallel
 * arrays with millisecond deltas — the compact shape ticket 21 fixed for the server, so F2 changes
 * nothing. All four arrays have the same length.
 */
export interface KeystrokeEventLog {
  readonly formatVersion: number
  /** Milliseconds since the previous event. The first entry is the delay before the first key. */
  readonly dt: readonly number[]
  readonly kind: readonly KeystrokeKind[]
  /** The character produced, or `null` for `backspace` and `ignored`. */
  readonly char: readonly (string | null)[]
  /** Whether the keystroke matched the awaited character. `false` for `backspace` and `ignored`. */
  readonly correct: readonly boolean[]
}

export interface RhythmConsistency {
  /** `100 × max(0, 1 − cv)` over eligible intervals — research R5. */
  readonly value: number
  /** Intervals over 3000 ms, excluded as breaks. Reported so a smooth figure cannot hide them. */
  readonly breaksExcluded: number
}

/** All derived from the log after the fact, never accumulated as the learner types — FR-019. */
export interface AttemptMetrics {
  /** Characters per minute. The primary figure. */
  readonly spm: number
  /** Exactly `spm / 5` — FR-023. */
  readonly wpm: number
  /**
   * Correct character keystrokes over **all** character keystrokes, in [0, 1]. A wrong keystroke
   * stays counted after a Backspace correction; Backspace is not in the denominator — FR-024.
   */
  readonly accuracy: number
  /** Total wrong character keystrokes, corrected or not. */
  readonly errorCount: number
  readonly errorsByChar: Readonly<Record<string, number>>
  readonly rhythmConsistency: RhythmConsistency
  readonly meanIkiByKey: Readonly<Record<string, number>>
  readonly meanIkiByTransition: Readonly<Record<TransitionKey, number>>
}

/**
 * Sum and sum-of-squares rather than a list of intervals: the smallest form from which both mean
 * and standard deviation are recoverable, and it folds.
 */
export interface ElementStats {
  readonly count: number
  readonly misses: number
  readonly sumIki: number
  readonly sumIkiSq: number
}

/** The only input to progress and Confidence (FR-028), and the part kept forever. */
export interface AttemptAggregates {
  readonly keys: Readonly<Record<string, ElementStats>>
  readonly transitions: Readonly<Record<TransitionKey, ElementStats>>
}

/** The exponentially-weighted counters behind Confidence — research R4. Opaque to callers. */
export interface ConfidenceState {
  readonly keys: Readonly<Record<string, WeightedCounters>>
  readonly transitions: Readonly<Record<TransitionKey, WeightedCounters>>
}

export interface WeightedCounters {
  readonly wHits: number
  readonly wMisses: number
  readonly wSumIki: number
  readonly wSumIkiSq: number
}

// ---------------------------------------------------------------------------------------------
// Attempt
// ---------------------------------------------------------------------------------------------

/** Only `test` counts toward mastery — FR-039. */
export type AttemptMode = 'practice' | 'test'

export interface Attempt {
  /** Client-generated UUID — the shape F2's idempotent outbox needs. */
  readonly id: string
  readonly scaleId: string
  readonly layoutId: LayoutId
  readonly language: Language
  readonly mode: AttemptMode
  /** The exact generated text, kept so a result can be re-read. */
  readonly text: string
  /** Reproduces `text` together with the scale and the unlocked set. */
  readonly seed: number
  readonly startedAt: number
  readonly completedAt: number
  /** Excludes time the tab spent unfocused. */
  readonly elapsedMs: number
  readonly metrics: AttemptMetrics
  readonly aggregates: AttemptAggregates
  /** `null` once pruned by the 20-attempt retention rule — FR-081. */
  readonly log: KeystrokeEventLog | null
}

/**
 * What the progress fold and the history list read. Everything an Attempt carries except the
 * keystroke log, which may be gone — so no derived value may ever depend on it (FR-081, SC-019).
 */
export type AttemptSummary = Omit<Attempt, 'log' | 'text'>

// ---------------------------------------------------------------------------------------------
// Progress — derived, never stored as a truth of its own
// ---------------------------------------------------------------------------------------------

/** FR-048's three options, in the order the learner is offered them. */
export type StartingLevelChoice = 'neverTouchTyped' | 'knowsHomeRow' | 'touchTypesWantsAccuracy'

export interface StageProgress {
  readonly current: 1
  /** Every scale complete and accuracy over the last five attempts at or above 96% — FR-044. */
  readonly stage1Complete: boolean
}

export interface Progress {
  /** Bumped when the fold changes, so a stale snapshot is detectable. */
  readonly derivedVersion: number
  /** One Progress per language — FR-051. */
  readonly language: Language
  /** Always a prefix of the layout's `unlockOrder`, plus the anchors and space — FR-042. */
  readonly unlockedSet: readonly string[]
  /** Test Attempts only; a failing attempt resets the entry to 0 — FR-039. */
  readonly consecutivePasses: Readonly<Record<string, number>>
  readonly completedScales: readonly string[]
  /** `undefined` below five observations rather than zero — research R4. */
  readonly keyConfidence: Readonly<Record<string, number | undefined>>
  readonly transitionConfidence: Readonly<Record<TransitionKey, number | undefined>>
  readonly stage: StageProgress
  readonly startingLevelChoice: StartingLevelChoice
  /** One entry per attempt, forever. */
  readonly history: readonly AttemptSummary[]
}

// ---------------------------------------------------------------------------------------------
// Next Action — exactly one, never zero, never two (SC-010)
// ---------------------------------------------------------------------------------------------

export type NextActionRule = 'lowerTempo' | 'weakTransition' | 'evenRhythm' | 'nextKey'

export interface NextAction {
  readonly rule: NextActionRule
  /** A message key, not a sentence: the exact wording is translatable and unit-testable — FR-034. */
  readonly template: string
  readonly values: Readonly<Record<string, string | number>>
  /** What the button starts. */
  readonly startsScaleId: string
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

export type ThemeSetting = 'system' | 'light' | 'dark' | 'lowVision'
export type MotionSetting = 'system' | 'reduced' | 'off'
export type SoundSetting = 'on' | 'off'
/** Stage 1 stops the caret on a wrong letter; later stages allow free correction — ticket 10. */
export type ErrorMode = 'stopOnLetter' | 'freeBackspace'

export interface Settings {
  readonly theme: ThemeSetting
  readonly motion: MotionSetting
  readonly sound: SoundSetting
  /** 24–40. */
  readonly textSizePx: number
  readonly errorMode: ErrorMode
  readonly typingLanguage: Language
  readonly layoutId: LayoutId
  /** Independent of `typingLanguage` — a learner may practise Ukrainian with an English UI (FR-068). */
  readonly interfaceLanguage: Language
}

// ---------------------------------------------------------------------------------------------
// The one shared helper, because two packages must encode a Transition key identically
// ---------------------------------------------------------------------------------------------

/**
 * The canonical encoding of a Transition as a record key.
 *
 * `metrics` writes these keys into `AttemptAggregates` and `curriculum` reads them back out, so
 * they cannot each have their own idea of the separator. It lives here for that reason alone.
 */
export function transitionKey(from: string, to: string): TransitionKey {
  return `${from}>${to}`
}

/** The inverse of {@link transitionKey}. Returns `undefined` for a string that is not one. */
export function parseTransitionKey(key: TransitionKey): { from: string; to: string } | undefined {
  const separator = key.indexOf('>')
  if (separator <= 0 || separator === key.length - 1) return undefined
  return { from: key.slice(0, separator), to: key.slice(separator + 1) }
}

// ---------------------------------------------------------------------------------------------
// Seam ports
//
// Declared here rather than in `apps/web/src/seams/` so that `packages/engine` can consume them
// without depending on the application. The seams directory holds the *adapters*; these are the
// interfaces they satisfy. Signatures follow `specs/001-typing-core/contracts/seams.md`.
// ---------------------------------------------------------------------------------------------

export interface Clock {
  /** Monotonic milliseconds. Never wall-clock — an attempt must survive a clock change. */
  now(): number
}

export interface Random {
  /** A float in [0, 1). Seeded, so a generated exercise is reproducible. */
  next(): number
  /**
   * An integer in [0, maxExclusive). The form `contracts/seams.md` specifies, and the one the
   * scale generators want — deriving it from `next()` at each call site is how a modulo bias
   * gets copy-pasted into eight generators.
   */
  nextInt(maxExclusive: number): number
}

export type InputEvent =
  | { readonly kind: 'char'; readonly char: string; readonly at: number }
  | { readonly kind: 'backspace'; readonly at: number }
  | {
      readonly kind: 'ignored'
      readonly reason: 'modifier' | 'composition' | 'deadKey' | 'repeat'
      readonly at: number
    }

export interface LayoutProbe {
  /** `false` only when the browser proves the layout cannot be typed; "cannot tell" is `true`. */
  readonly producible: boolean
  readonly suggestedLayoutId?: LayoutId
}

/** The only seam that knows a keyboard exists. The engine consumes events; it never reads the DOM. */
export interface InputSource {
  subscribe(listener: (event: InputEvent) => void): () => void
  /** Probe what the active physical layout produces, for the pre-start check (FR-021). */
  probeLayout(): Promise<LayoutProbe>
  focus(): void
}

// ---------------------------------------------------------------------------------------------
// The stored envelope — everything `ProgressStore` persists, in one version-marked object
// ---------------------------------------------------------------------------------------------

/**
 * `specs/001-typing-core/data-model.md` § The stored envelope (FR-082, FR-083).
 *
 * Attempts and their keystroke logs are stored **apart**, keyed by attempt id, because the logs are
 * prunable and the summaries are not: only the last 20 logs are kept (FR-081), and discarding an
 * older one must change no metric, no confidence value and no unlocked key (SC-019). Keeping the
 * log inside the attempt record would make that rule a delete-and-hope; keeping it beside makes it
 * structurally impossible for a derived value to depend on a log that may be gone. It is also the
 * shape ticket 21 fixed for the server, so F2 changes nothing.
 */
export interface StoredEnvelope {
  /** Explicit and documented, so F2 can decide whether to import it. F1 has no migration code. */
  readonly storeVersion: number
  /** Used to resolve concurrent tabs — a stale write must never silently win. */
  readonly writtenAt: number
  readonly progressByLanguage: Readonly<Partial<Record<Language, Progress>>>
  readonly settings: Settings
  /**
   * The learner's answer to FR-048, per typing language, kept apart from `progressByLanguage`
   * because it survives an empty history: a learner who chooses a starting level and then closes
   * the tab before their first attempt must not be asked again.
   */
  readonly startingLevelByLanguage: Readonly<Partial<Record<Language, StartingLevelChoice>>>
  /** Kept forever. */
  readonly attempts: readonly AttemptSummary[]
  /** Keyed by attempt id. Only the 20 most recent survive — FR-081. */
  readonly logs: Readonly<Record<string, KeystrokeEventLog>>
  /**
   * When `settings` last changed, in epoch ms. Settings sync last-write-wins by it (ADR-0006).
   * Absent on an envelope that has never saved settings, which loses to any stamped copy.
   */
  readonly settingsUpdatedAt?: number
}

/** What the current build writes. A different value on disk is FR-083's deliberate fresh start. */
export const STORE_VERSION = 1

/** The number of attempts whose keystroke logs are retained — FR-081. */
export const LOG_RETENTION_COUNT = 20
