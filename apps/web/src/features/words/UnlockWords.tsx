import { useNavigate } from '@tanstack/react-router'
import { drillPool, layouts, wordCatalogue } from '@typing-race/curriculum'
import type { LayoutId } from '@typing-race/domain'
import { Button } from '@typing-race/ui'
import { useMemo } from 'react'
import { m } from '../../paraglide/messages.js'
import { displayWord, glyph } from './labels.js'
import { useWordBank } from './useWordBank.js'
import './words.css'

const SHOWN = 6

/**
 * The Key Unlock moment, in words: the key just opened, and the first real words it makes
 * possible from the learner's unlocked set alone (requirements §9 step 3). Renders nothing when
 * the key has no word drill (a digit, a punctuation mark) or Stage 2 has not opened yet.
 */
export function UnlockWords({
  layoutId,
  unlockKey,
  unlocked,
}: {
  layoutId: LayoutId
  unlockKey: string
  unlocked: readonly string[]
}) {
  const layout = layouts[layoutId]
  const bank = useWordBank(layout.language)
  const navigate = useNavigate()
  const drill = wordCatalogue[layoutId].find(
    (candidate) =>
      (candidate.kind === 'newKey' || candidate.kind === 'ukLetter') &&
      candidate.focus?.value === unlockKey,
  )
  const words = useMemo(
    () =>
      bank.status === 'ready' && drill !== undefined
        ? drillPool({ drill, bank: bank.bank, layout, unlocked }).slice(0, SHOWN)
        : [],
    [bank, drill, layout, unlocked],
  )

  if (drill === undefined || words.length === 0) return null
  return (
    <section className="wunlock" aria-labelledby="unlock-words" data-testid="unlock-words">
      <h2 id="unlock-words" className="wunlock__title">
        {m.path_words_unlock_title({ key: glyph(unlockKey) })}
      </h2>
      <p className="wunlock__lead">{m.path_words_unlock_lead()}</p>
      <p className="wunlock__words" lang={layout.language}>
        {words.map((word, i) => (
          <span key={word} style={{ ['--i' as string]: i }}>
            {displayWord(word)}
          </span>
        ))}
      </p>
      <div>
        <Button
          onClick={() =>
            void navigate({
              to: '/exercise/$scaleId',
              params: { scaleId: drill.id },
              search: { mode: 'practice' },
            })
          }
        >
          {m.path_words_unlock_start()}
        </Button>
      </div>
    </section>
  )
}
