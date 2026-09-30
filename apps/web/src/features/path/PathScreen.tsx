import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Chip, type ChipTone } from '@typing-race/ui'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { AcademyStageLink } from '../academy/StageLink.js'
import { WordsSection } from '../words/WordsSection.js'
import { PathKeyboard } from './Keyboard.js'
import { keyLabel, scaleName } from './labels.js'
import { MASTERY_STREAK, type ScaleState, scaleRows } from './model.js'
import { Review } from './Review.js'
import { StartingLevel } from './StartingLevel.js'

/**
 * T111. Path, L2 — the Stage 1 ladder: the keyboard, then the scales in Unlock Order.
 *
 * Everything shown is read from derived `Progress`. The unlocked set is always a prefix of the
 * layout's Unlock Order (FR-042) because the fold builds it so; drawing from it rather than from
 * any local list is what keeps this screen unable to disagree.
 */

function stateChip(state: ScaleState): { tone: ChipTone; label: string } {
  switch (state.kind) {
    case 'complete':
      return { tone: 'sage', label: m.path_scale_state_complete() }
    case 'inProgress':
      return {
        tone: 'neutral',
        label: m.path_scale_state_inProgress({ count: state.count, target: MASTERY_STREAK }),
      }
    case 'notStarted':
      return { tone: 'neutral', label: m.path_scale_state_notStarted() }
    case 'locked':
      return { tone: 'muted', label: m.path_scale_state_locked() }
  }
}

function lockText(state: ScaleState): string | null {
  if (state.kind !== 'locked') return null
  return state.reason.kind === 'requires'
    ? m.path_scale_lock_requires({ keys: state.reason.keys.map(keyLabel).join(' ') })
    : m.path_scale_lock_focus({ key: keyLabel(state.reason.key) })
}

export function PathScreen() {
  const navigate = useNavigate()
  const { progress, layout, catalogue } = useDerived()

  if (progress === null) return <StartingLevel mode="first" />

  const rows = scaleRows(layout, catalogue, progress)

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-ui text-2xl font-bold">{m.path_path_title()}</h1>
        <p className="mt-1 font-ui text-muted">{m.path_path_lead()}</p>
      </header>

      <Card className="p-6" role="region" aria-labelledby="path-keyboard-title">
        <h2 id="path-keyboard-title" className="font-ui text-lg font-bold">
          {m.path_keyboard_title()}
        </h2>
        <div className="mt-3">
          <PathKeyboard layout={layout} progress={progress} />
        </div>
      </Card>

      <Card className="p-6" role="region" aria-labelledby="path-scales-title">
        <h2 id="path-scales-title" className="font-ui text-lg font-bold">
          {m.path_scales_title()}
        </h2>
        <p className="mt-1 font-ui text-sm text-muted">{m.path_scales_lead()}</p>
        <ol className="mt-4 grid gap-2">
          {rows.map(({ scale, state }) => {
            const chip = stateChip(state)
            const lock = lockText(state)
            const name = scaleName(scale)
            return (
              <li
                key={scale.id}
                data-state={state.kind}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-hairline px-4 py-2"
              >
                <span className="min-w-40 flex-1">
                  <span className="font-ui font-semibold">{name}</span>
                  {lock !== null && (
                    <span className="block font-ui text-sm text-muted">{lock}</span>
                  )}
                </span>
                <Chip tone={chip.tone}>{chip.label}</Chip>
                {state.kind !== 'locked' && (
                  <Button
                    size="md"
                    aria-label={m.path_scale_start_named({ name })}
                    onClick={() =>
                      void navigate({
                        to: '/exercise/$scaleId',
                        params: { scaleId: scale.id },
                        search: { mode: 'practice' },
                      })
                    }
                  >
                    {m.path_scale_start()}
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      </Card>

      <WordsSection layout={layout} progress={progress} />

      <Card className="p-6" role="region" aria-labelledby="path-later-title">
        <h2 id="path-later-title" className="font-ui text-lg font-bold">
          {m.path_later_title()}
        </h2>
        <ul className="mt-3 grid gap-2">
          <li>
            <AcademyStageLink />
          </li>
        </ul>
      </Card>

      {/* FR-047: a way to practise weak keys and Transitions specifically. It sits below the
          ladder rather than on Today, because Today carries the one next action and a second
          list there would be two answers to the same question (SC-010). */}
      <Review progress={progress} layout={layout} catalogue={catalogue} />

      <StartingLevel mode="change" />
    </div>
  )
}
