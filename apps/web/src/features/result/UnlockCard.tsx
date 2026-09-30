import { useNavigate } from '@tanstack/react-router'
import { allowsCelebration, Button, prefersReducedMotion, resolveMotion } from '@typing-race/ui'
import { useEffect, useRef } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { displayChar, fingerName, scaleName, type Unlock } from './model.js'

/** How many opened scales the card names before saying "and N more". */
const NAMED_SCALES = 3

/**
 * The confetti palette. Canvas cannot read CSS custom properties, so these repeat three tokens
 * from `tokens.css`: the brand red, the near-white surface and the dark steel of the hero frame.
 */
const CONFETTI_COLOURS = ['#c21f13', '#f9fafb', '#16222b']

/**
 * The Key Unlock block: the brand's red block with its rounded corner, the new key set huge in
 * the display face, the finger that types it, what it opens and one button to the first drill.
 * This is the requirements' demo step, so it is a block on the result and never a full-screen
 * moment.
 *
 * Rendered from the `Unlock` the model derived from **store data**; this component knows no rule.
 *
 * The burst is the one celebration on the screen. `canvas-confetti` is imported dynamically and
 * only after `allowsCelebration` says yes, so with motion reduced or off the chunk is never
 * fetched at all (motion.md) — the flag is a bundle decision, not merely a visual one.
 */
export function UnlockCard({
  unlock,
  attemptId,
}: {
  readonly unlock: Unlock
  readonly attemptId: string
}) {
  const navigate = useNavigate()
  const motionSetting = useAppStore((state) => state.settings.motion)
  const cardRef = useRef<HTMLElement>(null)
  const celebrate = allowsCelebration(resolveMotion(motionSetting, prefersReducedMotion()))

  // `attemptId` is a dependency so that opening a different result replays the burst, and so that
  // re-rendering this one never does.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!celebrate) return
    let cancelled = false
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return
        const rect = cardRef.current?.getBoundingClientRect()
        void confetti({
          particleCount: 40,
          spread: 70,
          colors: CONFETTI_COLOURS,
          // One burst from the card's centre, as a fraction of the viewport.
          origin: rect
            ? {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight,
              }
            : { x: 0.5, y: 0.5 },
          disableForReducedMotion: true,
        })
      })
      .catch(() => {
        // A celebration is never worth an error: a blocked canvas simply means no burst.
      })
    return () => {
      cancelled = true
    }
  }, [celebrate, attemptId])

  const names = unlock.opens.map(scaleName)
  const shown = names.slice(0, NAMED_SCALES).join('; ')
  const rest = names.length - NAMED_SCALES
  const opens =
    names.length === 0
      ? m.result_unlock_opens_none()
      : m.result_unlock_opens({
          scales: rest > 0 ? m.result_unlock_opens_more({ scales: shown, count: rest }) : shown,
        })
  const drill = unlock.firstDrill

  return (
    <section
      ref={cardRef}
      aria-labelledby="result-unlock"
      className="result-unlock unlock gp-host gp-host--ember panel--corner"
    >
      <GradLayer tone="ember" seed={5} count={4} />
      <span className="unlock__glyph result-unlock-glyph" aria-hidden="true">
        {displayChar(unlock.key)}
      </span>
      <div className="unlock__text">
        <h2 id="result-unlock" className="flabel unlock__heading">
          {m.result_unlock_heading()}
        </h2>
        <p className="unlock__key">{m.result_unlock_key({ key: displayChar(unlock.key) })}</p>
        <p className="unlock__line">
          {m.result_unlock_finger({ finger: fingerName(unlock.finger) })}
        </p>
        <p className="unlock__line">{opens}</p>
        <p className="unlock__reason">{m.result_unlock_reason()}</p>
        {drill === undefined ? null : (
          <Button
            variant="secondary"
            size="lg"
            className="unlock__cta"
            onClick={() => {
              void navigate({
                to: '/exercise/$scaleId',
                params: { scaleId: drill.id },
                search: { mode: 'practice' },
              })
            }}
          >
            {m.result_unlock_start()}
          </Button>
        )}
      </div>
    </section>
  )
}
