# Contract: the seams

**Owner**: Foundational phase — `apps/web/src/seams/**` · **Spec**: [../spec.md](../spec.md)

The five seams agreed in [plan.md](../plan.md#agreed-test-seams), before any test is written
(Constitution III). Each has a real adapter and an in-memory adapter behind one interface.

**The rule these exist to enforce**: no code outside `apps/web/src/seams/` touches IndexedDB, the
Cache API, `performance.now()`, `Math.random()` or a DOM input event. This is a lint rule, not a
convention.

## `Clock`

```ts
export interface Clock {
  /** Monotonic milliseconds. Never wall-clock — attempts must survive a clock change. */
  now(): number
}

export const systemClock: Clock                    // performance.now()
export function manualClock(start?: number): Clock & { advance(ms: number): void }
```

Every metric in [research R4, R5, R8](../research.md) is a function of time. Without `manualClock`
there is no way to assert on rhythm, on confidence decay, or on the 3000 ms break rule.

## `InputSource`

The only seam that knows a keyboard exists. The engine consumes events; it never reads the DOM.

```ts
export type InputEvent =
  | { kind: 'char';      char: string; at: number }
  | { kind: 'backspace';                at: number }
  | { kind: 'ignored';   reason: 'modifier' | 'composition' | 'deadKey'; at: number }

export interface InputSource {
  subscribe(listener: (event: InputEvent) => void): () => void
  /** Probe what the active physical layout produces, for the pre-start check (FR-021). */
  probeLayout(): Promise<{ producible: boolean; suggestedLayoutId?: string }>
  focus(): void
}

export function domInputSource(el: HTMLTextAreaElement, clock: Clock): InputSource
export function scriptedInput(events: InputEvent[]): InputSource
```

`domInputSource` reads `beforeinput` and `compositionend` for characters and `keydown` only for
timing and modifiers (ADR-0003) — the only path that works for Ukrainian and the only one Playwright
can drive. `ignored` is emitted, not swallowed, so FR-020 is provable.

**Hidden inside**: the hidden textarea's value reconciliation, composition buffering, the
`preventDefault` quirk where Firefox ignores it on `beforeinput`, and dead-key coalescing. None of it
appears in this surface.

## `ProgressStore`

**The seam F2 replaces with Supabase.** Its shape is designed for that now: asynchronous, batched,
idempotent by attempt id, version-marked.

```ts
export interface ProgressStore {
  load(): Promise<StoredEnvelope | 'empty' | 'unreadable-version' | 'unavailable'>
  /** Idempotent on attempt.id, so a retry cannot double-count. */
  appendAttempts(attempts: Attempt[]): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  clear(): Promise<void>
}

export function indexedDbStore(): ProgressStore
export function memoryStore(seed?: Partial<StoredEnvelope>): ProgressStore
```

`load` returns four outcomes rather than throwing, because each has its own screen: `unreadable-version`
is FR-083's deliberate fresh start, `unavailable` is FR-052's plain message with practice still
running. `memoryStore(seed)` is what lets US2, US3 and US6 be tested independently of each other.

**Hidden inside**: the IndexedDB schema, the 20-log retention rule, the `storeVersion` envelope, and
the concurrent-tab resolution.

## `AssetCache`

```ts
export interface AssetCache {
  register(): Promise<'active' | 'unsupported' | 'failed'>
  status(): 'active' | 'unsupported' | 'failed' | 'idle'
}

export function serviceWorkerCache(): AssetCache
export function noAssetCache(): AssetCache        // always 'unsupported'
```

Every test but the one offline end-to-end runs with `noAssetCache`. Without that, a stale cache
silently passes a failing build.

## `Random`

```ts
export interface Random { nextInt(maxExclusive: number): number }

export function seededRandom(seed: number): Random
```

The scale generators are pure functions of a seed ([research R6](../research.md#r6-generating-the-eight-stage-1-scale-types-from-a-finger-map)).
A test that cannot fix the seed cannot assert on generated text. There is no unseeded variant.

## `MotionFlag`

Not an outside-world seam, but read once at boot from `packages/ui` and settable from a test, because
motion-off is what makes visual comparisons deterministic.

```ts
export type MotionSetting = 'system' | 'reduced' | 'off'
export function resolveMotion(setting: MotionSetting, prefersReduced: boolean): 'full' | 'reduced' | 'off'
```

`off` turns every duration token to `0.01ms`, skips the confetti import entirely, and disables sound
(FR-064).
