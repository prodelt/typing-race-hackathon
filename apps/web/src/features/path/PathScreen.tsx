import { useNavigate } from '@tanstack/react-router'
import { buttonClass, Index } from '@typing-race/ui'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { AcademyStageLink } from '../academy/StageLink.js'
import { order, ScreenHead } from '../screen.js'
import { WordsSection } from '../words/WordsSection.js'
import { PathKeyboard } from './Keyboard.js'
import { keyLabel, scaleName } from './labels.js'
import { MASTERY_STREAK, type ScaleState, scaleRows } from './model.js'
import { Review } from './Review.js'
import { StartingLevel } from './StartingLevel.js'
import './path.css'

/**
 * Path — the Stage 1 ladder: the keyboard, then the scales in Unlock Order.
 *
 * Everything shown is read from derived `Progress`. The unlocked set is always a prefix of the
 * layout's Unlock Order because the fold builds it so; drawing from it rather than from any local
 * list is what keeps this screen unable to disagree.
 *
 * Laid out as numbered sections of one long page, the way the brand site is: a board with its one
 * big number, a two-column ladder, the stages still to come, the weak spots, the starting level.
 */

/** Locked rows shown after the last open one, so the learner sees what comes next. */
const LOCKED_SHOWN = 6
/** Never fold a ladder shorter than this: two even columns of the first rungs. */
const MIN_SHOWN = 12

function stateText(state: ScaleState): string {
  switch (state.kind) {
    case 'complete':
      return m.path_scale_state_complete()
    case 'inProgress':
      return m.path_scale_state_inProgress({ count: state.count, target: MASTERY_STREAK })
    case 'notStarted':
      return m.path_scale_state_notStarted()
    case 'locked':
      return state.reason.kind === 'requires'
        ? m.path_scale_lock_requires({ keys: state.reason.keys.map(keyLabel).join(' ') })
        : m.path_scale_lock_focus({ key: keyLabel(state.reason.key) })
  }
}

export function PathScreen() {
  const navigate = useNavigate()
  const { progress, layout, catalogue } = useDerived()

  if (progress === null) return <StartingLevel mode="first" />

  const rows = scaleRows(layout, catalogue, progress)
  const lastOpen = rows.findLastIndex(({ state }) => state.kind !== 'locked')
  const cut = Math.max(lastOpen + 1 + LOCKED_SHOWN, MIN_SHOWN)
  const shown = rows.slice(0, cut)
  const folded = rows.slice(cut)

  const row = ({ scale, state }: (typeof rows)[number], index: number) => {
    const name = scaleName(scale)
    return (
      <li key={scale.id} data-state={state.kind} className="ladder__row">
        <span
          className={state.kind === 'locked' ? 'disc disc--sm disc--empty' : 'disc disc--sm'}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="min-w-0">
          <span className="ladder__name">{name}</span>
          <span className="ladder__state">{stateText(state)}</span>
        </span>
        {state.kind !== 'locked' && (
          <button
            type="button"
            className={`${buttonClass(state.kind === 'complete' ? 'quiet' : 'secondary', 'sm')} ladder__go`}
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
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="screen">
      <ScreenHead
        n={2}
        label={m.path_where_stage_value({ n: progress.stage.current })}
        title={m.path_path_title()}
        lede={m.path_path_lead()}
        dot
      />

      <section
        id="keyboard"
        data-section={m.path_keyboard_title()}
        className="path-sec rise"
        style={order(1)}
        aria-labelledby="path-keyboard-title"
      >
        <Index n={1}>{m.path_keyboard_title()}</Index>
        <h2 id="path-keyboard-title" className="sr-only">
          {m.path_keyboard_title()}
        </h2>
        <PathKeyboard layout={layout} progress={progress} />
      </section>

      <section
        id="scales"
        data-section={m.path_scales_title()}
        className="path-sec"
        aria-labelledby="path-scales-title"
      >
        <div className="path-sec__head">
          <div>
            <Index n={2}>{m.path_scales_lead()}</Index>
            <h2 id="path-scales-title" className="path-sec__title">
              {m.path_scales_title()}
            </h2>
          </div>
        </div>
        <ol className="ladder">{shown.map(row)}</ol>
        {folded.length > 0 && (
          // The far end of the ladder is many locked rows that all say the same kind of thing.
          // They stay in the document (and in reach), folded under one line that counts them.
          <details className="ladder-more">
            <summary>{m.path_scales_more({ count: folded.length })}</summary>
            <ol className="ladder" start={shown.length + 1}>
              {folded.map((entry, i) => row(entry, shown.length + i))}
            </ol>
          </details>
        )}
      </section>

      <WordsSection layout={layout} progress={progress} />

      <section
        id="later"
        data-section={m.path_later_title()}
        className="path-sec"
        aria-labelledby="path-later-title"
      >
        <Index n={4} />
        <h2 id="path-later-title" className="path-sec__title">
          {m.path_later_title()}
        </h2>
        <ul className="later later--one">
          <li>
            <AcademyStageLink />
          </li>
        </ul>
      </section>

      {/* A way to practise weak keys and Transitions specifically. It sits below the ladder rather
          than on Today, because Today carries the one next action and a second list there would
          be two answers to the same question. */}
      <Review progress={progress} layout={layout} catalogue={catalogue} />

      <StartingLevel mode="change" />
    </div>
  )
}
