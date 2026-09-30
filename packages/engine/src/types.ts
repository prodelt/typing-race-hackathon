/** The five phases of an Attempt. `abandoned` produces no Attempt at all (data-model.md). */
export type AttemptState = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned'

/**
 * Everything the typing line needs to repaint, and nothing else. There is deliberately no speed,
 * accuracy or rhythm field: a repaint driven by `onChange` must not be able to touch anything
 * outside the typing line (FR-069), and metrics are derived from the log by `packages/metrics`
 * so a server can recompute them (ADR-0007).
 */
export interface EngineView {
  readonly state: AttemptState
  /** Index of the awaited character in `text`, counted in characters (code points). */
  readonly cursor: number
  /** Set while a wrong keystroke is unresolved (FR-016, FR-017). */
  readonly markedAt: number | null
  /** Wrong character keystrokes, corrected or not. Never lowered (FR-024). */
  readonly errorCount: number
  /** Milliseconds spent running; excludes paused and unfocused time. */
  readonly elapsedMs: number
  /** `at` is the text index the wrong keystroke was offered against. Survives Backspace (FR-022). */
  readonly lastError: { expected: string; got: string; at: number } | null
}
