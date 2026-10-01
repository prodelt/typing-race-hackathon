import type { Finger, Hand, Key, Layout } from '@typing-race/domain'
import { cx } from '@typing-race/ui'
import { type RefObject, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { displayChar, fingerLabel, LAYOUT_NAMES } from '../exercise/labels.js'
import { fingerZones, type Zone } from './model.js'

/**
 * Step 3: which finger owns which keys, drawn the way the play screen draws it — B's four finger
 * zones, white at the pinkies deepening to the index fingers, the same on both hands — with the
 * two hands beside it. Pressing any key lights that key and its finger and names the finger, so
 * the scheme can be tried before the first exercise. Keys are matched on `event.code`, the
 * physical key, so the scheme answers on either operating-system layout.
 */

const ROWS = ['digit', 'top', 'home', 'bottom'] as const

/** The home-row bumps: the left and right index fingers' resting keys. */
const BUMPS = new Set(['KeyF', 'KeyJ'])

const ZONE_NAMES: readonly { readonly zone: Zone | 'thumb'; readonly name: () => string }[] = [
  { zone: 0, name: () => m.firstrun_zone_pinky() },
  { zone: 1, name: () => m.firstrun_zone_ring() },
  { zone: 2, name: () => m.firstrun_zone_middle() },
  { zone: 3, name: () => m.firstrun_zone_index() },
  { zone: 'thumb', name: () => m.firstrun_zone_thumb() },
]

function glyphOf(key: Key): string {
  if (key.kind === 'modifier') return 'Shift'
  if (key.kind === 'space') return m.firstrun_space()
  return displayChar(key.plain)
}

export function FingerScheme(props: {
  readonly layout: Layout
  readonly titleRef: RefObject<HTMLHeadingElement | null>
}) {
  const { layout } = props
  const zones = fingerZones(layout)
  const [pressed, setPressed] = useState<Key | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Enter' || event.key === 'Escape' || event.key === 'Tab') return
      const key = layout.keys.find((k) => k.code === event.code)
      if (key === undefined) return
      // The key belongs to the scheme now: a digit must not switch destinations, Space must not
      // scroll, a letter must not type into anything.
      event.preventDefault()
      setPressed(key)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [layout])

  const left = layout.homeAnchors[3] ?? ''
  const right = layout.homeAnchors[4] ?? ''
  const active = pressed === null ? null : { hand: pressed.hand, finger: pressed.finger }

  const renderKey = (key: Key) => (
    <span
      key={key.code}
      className={cx(
        'fr-key',
        key.kind === 'modifier' && 'fr-key--wide',
        key.kind === 'space' && 'fr-key--space',
        BUMPS.has(key.code) && 'fr-key--bump',
      )}
      data-zone={key.kind === 'space' ? 'thumb' : zones.get(key.code)}
      data-code={key.code}
      data-on={pressed?.code === key.code || undefined}
    >
      {glyphOf(key)}
    </span>
  )

  const shifts = layout.keys.filter((key) => key.kind === 'modifier')
  const space = layout.keys.find((key) => key.kind === 'space')

  return (
    <section className="fr-step fr-step--fingers" aria-labelledby="fr-fingers-title">
      <div className="fr-intro" id="fr-fingers-title">
        <h1 className="fr-title" ref={props.titleRef} tabIndex={-1}>
          {m.firstrun_fingers_title()}
        </h1>
        <p className="fr-lead">{m.firstrun_fingers_lead({ left, right })}</p>
      </div>

      <div className="fr-scheme">
        <div className="fr-kb-wrap">
          <div
            className="fr-kb"
            role="img"
            aria-label={m.firstrun_fingers_keyboard({ layout: LAYOUT_NAMES[layout.id] })}
            data-testid="finger-scheme"
          >
            {ROWS.map((row) => (
              <div key={row} className="fr-kb__row" data-row={row}>
                {row === 'bottom' && shifts[0] !== undefined ? renderKey(shifts[0]) : null}
                {layout.keys
                  .filter(
                    (key) => key.row === row && key.kind !== 'modifier' && key.kind !== 'space',
                  )
                  .map(renderKey)}
                {row === 'bottom' && shifts[1] !== undefined ? renderKey(shifts[1]) : null}
              </div>
            ))}
            {space === undefined ? null : (
              <div className="fr-kb__row" data-row="space">
                {renderKey(space)}
              </div>
            )}
          </div>
          <ul className="fr-legend">
            {ZONE_NAMES.map(({ zone, name }) => (
              <li key={zone}>
                <i data-zone={zone} aria-hidden="true" />
                {name()}
              </li>
            ))}
          </ul>
        </div>

        <aside className="fr-hands" aria-label={m.firstrun_fingers_hands()}>
          <p className="fr-hands__say" aria-live="polite" data-testid="finger-said">
            {pressed === null ? (
              m.firstrun_fingers_try()
            ) : (
              <>
                <span className="fr-hands__key">{glyphOf(pressed)}</span>
                <b>
                  {m.firstrun_fingers_pressed({
                    key: glyphOf(pressed),
                    finger: fingerLabel({ hand: pressed.hand, finger: pressed.finger }),
                  })}
                </b>
              </>
            )}
          </p>
          <Hands active={active} />
          <div className="fr-hands__cap" aria-hidden="true">
            <span>{m.firstrun_fingers_left()}</span>
            <span>{m.firstrun_fingers_right()}</span>
          </div>
        </aside>
      </div>
    </section>
  )
}

/** Finger lengths, pinky to index, as in B's play screen. */
const LENGTHS: Record<Exclude<Finger, 'thumb'>, number> = {
  pinky: 40,
  ring: 54,
  middle: 60,
  index: 54,
}
const ORDER: readonly Exclude<Finger, 'thumb'>[] = ['pinky', 'ring', 'middle', 'index']
const ZONE_OF: Record<Exclude<Finger, 'thumb'>, Zone> = { pinky: 0, ring: 1, middle: 2, index: 3 }

function Hands({ active }: { readonly active: { hand: Hand; finger: Finger } | null }) {
  const lit = (hand: 'left' | 'right', finger: Finger): boolean =>
    active !== null &&
    active.finger === finger &&
    (active.hand === hand || (finger === 'thumb' && active.hand === 'thumbs'))

  return (
    <svg className="fr-hands__svg" viewBox="0 0 200 104" aria-hidden="true">
      {(['left', 'right'] as const).map((hand) => {
        const right = hand === 'right'
        const ox = right ? 119 : 4
        const thumbX = right ? ox - 17 : ox + 80
        return (
          <g key={hand}>
            {ORDER.map((finger, i) => {
              const slot = right ? 3 - i : i
              const len = LENGTHS[finger]
              return (
                <rect
                  key={finger}
                  className="fr-finger"
                  data-zone={ZONE_OF[finger]}
                  data-on={lit(hand, finger) || undefined}
                  data-finger={`${hand}-${finger}`}
                  x={ox + slot * 20}
                  y={66 - len}
                  width={17}
                  height={len + 4}
                  rx={8.5}
                />
              )
            })}
            <rect
              className="fr-finger"
              data-zone="thumb"
              data-on={lit(hand, 'thumb') || undefined}
              data-finger={`${hand}-thumb`}
              x={thumbX}
              y={50}
              width={16}
              height={32}
              rx={8}
              transform={`rotate(${right ? 30 : -30} ${thumbX + 8} 82)`}
            />
            <rect className="fr-palm" x={ox} y={66} width={77} height={34} />
          </g>
        )
      })}
    </svg>
  )
}
