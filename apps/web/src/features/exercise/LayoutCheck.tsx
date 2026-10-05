import { keyOf } from '@typing-race/curriculum'
import type { InputSource, Layout } from '@typing-race/domain'
import { Button } from '@typing-race/ui'
import { useCallback, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { LAYOUT_NAMES } from './labels.js'

type Probe = 'checking' | 'ok' | 'mismatch'

export interface LayoutCheck {
  readonly probe: Probe
  /** The keyboard cannot produce the text: Start stays disabled until it can. */
  readonly mismatch: boolean
  /** A letter of this layout has been typed: the one proof of the Active layout a browser can give. */
  readonly confirmed: boolean
  readonly recheck: () => void
}

/**
 * The pre-start layout check (TZ §4.2, FR-021), shared by every run that types a text: an exercise
 * and the sprint.
 *
 * It has two halves because no single one works everywhere. `navigator.keyboard` reports the
 * physical layout but exists only in Chromium; the `InputSource` probe therefore reports "cannot
 * tell" elsewhere, and the typed-character half catches the rest: a Latin letter typed against a
 * Ukrainian text, or the reverse, is a mismatch no matter which browser said nothing.
 */
export function useLayoutCheck(input: InputSource, layout: Layout): LayoutCheck {
  const [probe, setProbe] = useState<Probe>('checking')
  const [typedMismatch, setTypedMismatch] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const check = useCallback(() => {
    let live = true
    setProbe('checking')
    void input.probeLayout().then((result) => {
      if (live) setProbe(result.producible ? 'ok' : 'mismatch')
    })
    return () => {
      live = false
    }
  }, [input])

  useEffect(() => check(), [check])

  useEffect(
    () =>
      input.subscribe((event) => {
        if (event.kind !== 'char' || !/\p{L}/u.test(event.char)) return
        const foreign = keyOf(layout, event.char.toLowerCase()) === undefined
        setTypedMismatch(foreign)
        setConfirmed(!foreign)
      }),
    [input, layout],
  )

  return {
    probe,
    mismatch: probe === 'mismatch' || typedMismatch,
    confirmed,
    recheck: () => {
      setTypedMismatch(false)
      check()
    },
  }
}

/** What the check found, in one line: a calm status, or the mismatch with a way to check again. */
export function LayoutStatus({
  layout,
  check,
}: {
  readonly layout: Layout
  readonly check: LayoutCheck
}) {
  const layoutName = LAYOUT_NAMES[layout.id]
  if (check.mismatch) {
    return (
      <div
        role="alert"
        data-testid="layout-mismatch"
        className="mt-6 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-terracotta bg-terracotta-tint p-4"
      >
        <p className="font-ui leading-relaxed">
          {m.exercise_layout_mismatch({ layout: layoutName })}
        </p>
        <Button className="mt-3" onClick={check.recheck}>
          {m.exercise_layout_recheck()}
        </Button>
      </div>
    )
  }
  return (
    <p role="status" className="mt-6 font-ui text-sm leading-relaxed text-ink/80">
      {check.probe === 'checking'
        ? m.exercise_layout_checking()
        : check.confirmed
          ? m.exercise_layout_confirmed({ layout: layoutName })
          : m.exercise_layout_ok({ layout: layoutName })}
    </p>
  )
}
