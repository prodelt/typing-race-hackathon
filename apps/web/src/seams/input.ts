import type { Clock, InputEvent, InputSource, LayoutId, LayoutProbe } from '@typing-race/domain'
import { provesUnproducible, shapeOfLayoutMap } from './layoutMap.js'

/**
 * T016–T018. The only seam that knows a keyboard exists.
 *
 * Why a hidden textarea read through `beforeinput` rather than `keydown`
 * ([ADR-0003](../../../../docs/adr/0003-react-spa-with-input-engine-outside-the-framework.md),
 * research 03 and 06): `keydown` carries no reliable character for Ukrainian, and Playwright's
 * keyboard API cannot type Cyrillic in **any** engine — `press('й')` throws. Text-input events are
 * the only path that works for the learner and the only one the tests can drive. `keydown` is kept
 * for exactly two things: timing, and telling a modifier chord apart from a character.
 *
 * `ignored` events are emitted rather than swallowed. FR-020 promises that a modifier, an input
 * method or a dead key does not break the session, and an event nobody records cannot prove that.
 */

/** The `beforeinput` input types that mean "the learner deleted backwards". */
const BACKSPACE_INPUT_TYPES = new Set(['deleteContentBackward', 'deleteWordBackward'])

/** Input types we accept as producing characters outside a composition. */
const INSERT_INPUT_TYPES = new Set(['insertText', 'insertLineBreak', 'insertParagraph'])

/**
 * `navigator.keyboard` is Chromium-only and absent from the standard DOM library. Declared
 * narrowly here so the one cast in `probeLayout` stays honest about what it assumes.
 */
interface KeyboardLayoutCapableNavigator {
  readonly keyboard?: {
    getLayoutMap(): Promise<ReadonlyMap<string, string>>
  }
}

export interface DomInputSourceOptions {
  /** The layout the current exercise expects, so the probe can say which one to switch to. */
  readonly expectedLayoutId?: LayoutId
}

export function domInputSource(
  element: HTMLTextAreaElement,
  clock: Clock,
  options: DomInputSourceOptions = {},
): InputSource {
  const listeners = new Set<(event: InputEvent) => void>()
  let composing = false

  const emit = (event: InputEvent): void => {
    for (const listener of listeners) listener(event)
  }

  /**
   * One `char` event per code point, in order. A composition or an input method can replace
   * several characters at once, and the spec's edge case requires each to be judged in turn rather
   * than the group being taken as one keystroke. Spread iterates code points, so a surrogate pair
   * stays one character.
   */
  const emitText = (text: string, at: number): void => {
    for (const char of text) emit({ kind: 'char', char, at })
  }

  /**
   * The textarea must never accumulate text: it is an input conduit, not a model of the attempt.
   *
   * `preventDefault()` alone is not enough — research 06 found Firefox ignores it on `beforeinput`
   * — so the value is cleared defensively as well. Clearing unconditionally is safe because
   * nothing ever reads it.
   */
  const drain = (): void => {
    if (element.value !== '') element.value = ''
  }

  const onBeforeInput = (event: Event): void => {
    const inputEvent = event as globalThis.InputEvent
    const at = clock.now()

    if (composing || inputEvent.inputType === 'insertCompositionText') {
      // Judged at `compositionend`, when the final text is known. Recording it now would count a
      // provisional guess as a keystroke.
      inputEvent.preventDefault()
      return
    }

    if (BACKSPACE_INPUT_TYPES.has(inputEvent.inputType)) {
      inputEvent.preventDefault()
      drain()
      emit({ kind: 'backspace', at })
      return
    }

    if (INSERT_INPUT_TYPES.has(inputEvent.inputType)) {
      inputEvent.preventDefault()
      drain()
      const text = inputEvent.data ?? (inputEvent.inputType === 'insertText' ? '' : '\n')
      if ([...text].length > 1) {
        // One key makes one character. Several in one insertion is a script or an extension typing
        // for the learner, the way a paste would (ADR-0003, 2026-10-06). An input method commits
        // through `compositionend` instead, which is still judged character by character.
        emit({ kind: 'ignored', reason: 'burst', at })
        return
      }
      emitText(text, at)
      return
    }

    // Paste, drag-drop, undo, format commands — none of them is a keystroke, and all of them are
    // worth recording so a session that looks odd can be explained.
    inputEvent.preventDefault()
    drain()
    emit({ kind: 'ignored', reason: 'composition', at })
  }

  const onCompositionStart = (): void => {
    composing = true
  }

  const onCompositionEnd = (event: Event): void => {
    composing = false
    const at = clock.now()
    const text = (event as CompositionEvent).data
    drain()
    if (text === '') {
      emit({ kind: 'ignored', reason: 'composition', at })
      return
    }
    emitText(text, at)
  }

  /**
   * `keydown` never produces a character here. It exists to record the two things `beforeinput`
   * cannot see: a dead key, which fires no input event at all until it resolves, and a modifier
   * chord, which fires none ever.
   */
  const onKeyDown = (event: KeyboardEvent): void => {
    const at = clock.now()

    // A held key repeats `keydown`, and each repeat would insert another character: one press
    // would score as a string of wrong letters. Cancelling the repeat's default stops its text.
    // A held Backspace stays, since deleting several characters is what holding it is for, and a
    // composition is left alone, because cancelling `keydown` there would break the input method.
    if (event.repeat && event.key !== 'Backspace' && !event.isComposing && !composing) {
      event.preventDefault()
      emit({ kind: 'ignored', reason: 'repeat', at })
      return
    }

    if (event.key === 'Dead') {
      emit({ kind: 'ignored', reason: 'deadKey', at })
      return
    }

    const isModifierItself = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)
    const isChord = (event.ctrlKey || event.metaKey || event.altKey) && event.key.length === 1
    if (isModifierItself || isChord) {
      emit({ kind: 'ignored', reason: 'modifier', at })
    }
  }

  element.addEventListener('beforeinput', onBeforeInput)
  element.addEventListener('compositionstart', onCompositionStart)
  element.addEventListener('compositionend', onCompositionEnd)
  element.addEventListener('keydown', onKeyDown)

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /**
     * FR-021's pre-start check, as far as the browser can answer it.
     *
     * `navigator.keyboard.getLayoutMap()` does **not** report the active layout: it returns the
     * highest-priority Latin layout, so with US and Ukrainian both installed `KeyF` is «f» whichever
     * is active. It can only *prove* a layout is missing (Russian-only for a Ukrainian text, no Latin
     * layout for an English one). Everything else is "cannot tell" and reports `producible: true`:
     * a false alarm for a learner who is on the right layout is worse than silence, and the letters
     * they type settle it in every browser.
     *
     * Absent outside Chromium, where it is always "cannot tell".
     */
    async probeLayout(): Promise<LayoutProbe> {
      const keyboard = (navigator as Navigator & KeyboardLayoutCapableNavigator).keyboard
      if (!keyboard) return { producible: true }

      try {
        const shape = shapeOfLayoutMap(await keyboard.getLayoutMap())
        const expected = options.expectedLayoutId
        if (shape === undefined || expected === undefined) return { producible: true }
        if (!provesUnproducible(shape, expected)) return { producible: true }
        return { producible: false, suggestedLayoutId: expected }
      } catch {
        // A permissions failure is not a layout mismatch. Let the learner type.
        return { producible: true }
      }
    },

    focus() {
      element.focus()
    },
  }
}

/**
 * T017. The in-memory adapter: a fixed event list, no DOM, no keyboard.
 *
 * Without it every engine test needs a document and a real keyboard, and the engine's whole point
 * is that it has neither. Replay is synchronous and starts on the first `subscribe`, so a test
 * reads like the sequence it is asserting about.
 */
export function scriptedInput(events: readonly InputEvent[]): InputSource {
  let replayed = false

  return {
    subscribe(listener) {
      if (!replayed) {
        replayed = true
        for (const event of events) listener(event)
      }
      return () => {}
    },
    probeLayout: () => Promise.resolve({ producible: true }),
    focus() {},
  }
}
