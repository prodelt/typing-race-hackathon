import { useNavigate } from '@tanstack/react-router'
import {
  allowsCelebration,
  Button,
  Keycap,
  prefersReducedMotion,
  resolveMotion,
} from '@typing-race/ui'
import { useEffect, useRef } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { displayChar, fingerName, scaleName, type Unlock } from './model.js'

/** How many opened scales the card names before saying "and N more". */
const NAMED_SCALES = 3

/**
 * T104, FR-041, FR-043. The Key Unlock card: a deep sage card with the new key on a keycap, the
 * finger that types it, what it opens and one button to the first drill. This is the requirements'
 * demo step, so it is a card on the result and never a full-screen moment.
 *
 * Rendered from the `Unlock` the model derived from **store data**; this component knows no rule.
 *
 * The burst is the one celebration on the screen. `canvas-confetti` is imported dynamically and
 * only after `allowsCelebration` says yes, so with motion reduced or off the chunk is never
 * fetched at all (motion.md) — the flag is a bundle decision, not merely a visual one. The drawing
 * lives in `burst.ts`, which keeps the library's worker off so the burst passes the site's CSP.
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
    void import('./burst.js')
      .then(({ burst }) => {
        if (cancelled) return
        // Read once the chunk is here: the card has settled by then.
        const rect = cardRef.current?.getBoundingClientRect()
        return burst(rect, { width: window.innerWidth, height: window.innerHeight })
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
      className="result-unlock rounded-[var(--radius-card)] bg-sage p-5 text-paper shadow-[var(--shadow-raised)]"
    >
      <h2 id="result-unlock" className="font-ui text-lg font-bold">
        {m.result_unlock_heading()}
      </h2>
      <div className="mt-4 flex items-center gap-4">
        <Keycap
          glyph={displayChar(unlock.key)}
          finger={unlock.finger?.finger ?? 'thumb'}
          tier="learning"
          className="result-unlock-glyph h-16 w-16 text-3xl"
        />
        <div>
          <p className="font-ui text-xl font-bold">
            {m.result_unlock_key({ key: displayChar(unlock.key) })}
          </p>
          <p className="font-ui">{m.result_unlock_finger({ finger: fingerName(unlock.finger) })}</p>
        </div>
      </div>
      <p className="mt-4 font-ui">{opens}</p>
      <p className="mt-1 font-ui text-sm opacity-90">{m.result_unlock_reason()}</p>
      {drill === undefined ? null : (
        <Button
          variant="secondary"
          size="lg"
          className="mt-4"
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
    </section>
  )
}
