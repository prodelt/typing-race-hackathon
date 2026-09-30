import { useNavigate } from '@tanstack/react-router'
import type { Layout, Progress } from '@typing-race/domain'
import { Button, Chip, type ChipTone, Index } from '@typing-race/ui'
import { useMemo } from 'react'
import { m } from '../../paraglide/messages.js'
import { displayWord, drillGoal, drillName, glyph } from './labels.js'
import {
  type DrillGroup,
  type DrillRow,
  type DrillState,
  featuredRow,
  groupOf,
  isOpenState,
  MASTERY_STREAK,
  stage2View,
} from './model.js'
import { useWordBank } from './useWordBank.js'
import './words.css'

/**
 * Stage 2 on the Path: real words from the keys the learner has opened.
 *
 * The newest key's words lead, in the one red panel of the screen, because that is the moment
 * the requirements' demo asks to see: a key opens and real words made only of learned characters
 * arrive with it. Below, three numbered groups: the length ladder, one drill per opened key, and
 * the separate skills of §3.2. Every row shows the first words it will draw, so what a drill
 * trains is visible before it starts.
 */
export function WordsSection({ layout, progress }: { layout: Layout; progress: Progress }) {
  const bank = useWordBank(layout.language)
  const view = useMemo(
    () => (bank.status === 'ready' ? stage2View(layout, progress, bank.bank) : null),
    [bank, layout, progress],
  )

  return (
    <section
      id="words"
      data-section={m.path_words_index()}
      className="words"
      aria-labelledby="path-words-title"
    >
      <header className="words__head">
        <Index n={3}>{m.path_words_index()}</Index>
        <h2 id="path-words-title" className="words__title">
          {m.path_words_title()}
        </h2>
        <p className="words__lede">{m.path_words_lead()}</p>
      </header>

      {bank.status === 'error' ? (
        <p role="alert" className="words__note">
          {m.path_words_error()}
        </p>
      ) : view === null ? (
        <div className="words__skeleton" role="status" aria-label={m.path_words_loading()}>
          <span />
          <span />
          <span />
        </div>
      ) : !view.open ? (
        <p className="words__note" data-testid="words-closed">
          {m.path_words_locked({ keys: view.missing.map(glyph).join(' ') })}
        </p>
      ) : (
        <OpenWords layout={layout} rows={view.rows} weak={view.weak} />
      )}
    </section>
  )
}

function OpenWords({
  layout,
  rows,
  weak,
}: {
  layout: Layout
  rows: readonly DrillRow[]
  weak: Parameters<typeof drillGoal>[2]
}) {
  const featured = featuredRow(rows, layout)
  const rest = rows.filter((row) => row !== featured)
  const inGroup = (group: DrillGroup) => rest.filter((row) => groupOf(row.drill, layout) === group)

  // Keys: the opened ones, then only the very next locked one; the rest is a count, not a list.
  const keyRows = inGroup('keys')
  const openKeys = keyRows.filter((row) => row.state.kind !== 'lockedKeys')
  const lockedKeys = keyRows.filter((row) => row.state.kind === 'lockedKeys')
  const shownKeys = [...openKeys, ...lockedKeys.slice(0, 1)]
  const ahead = lockedKeys.length - 1

  const groups: { id: DrillGroup; title: string; rows: readonly DrillRow[] }[] = [
    { id: 'ladder', title: m.path_words_group_ladder(), rows: inGroup('ladder') },
    { id: 'keys', title: m.path_words_group_keys(), rows: shownKeys },
    { id: 'sets', title: m.path_words_group_sets(), rows: inGroup('sets') },
  ]

  return (
    <>
      {featured === undefined ? null : <Featured row={featured} layout={layout} weak={weak} />}
      <div className="words__groups">
        {groups.map((group, index) => (
          <section key={group.id} className="wgroup" aria-labelledby={`words-group-${group.id}`}>
            <h3 id={`words-group-${group.id}`} className="wgroup__title">
              <Index n={index + 1} className="wgroup__index" />
              <span>{group.title}</span>
            </h3>
            <ol className="wgroup__list">
              {group.rows.map((row, i) => (
                <DrillItem key={row.drill.id} row={row} layout={layout} weak={weak} order={i} />
              ))}
            </ol>
            {group.id === 'keys' && ahead > 0 ? (
              <p className="wgroup__more">{m.path_words_keys_ahead({ count: ahead })}</p>
            ) : null}
          </section>
        ))}
      </div>
    </>
  )
}

function useStart(drillId: string) {
  const navigate = useNavigate()
  return () =>
    void navigate({
      to: '/exercise/$scaleId',
      params: { scaleId: drillId },
      search: { mode: 'practice' },
    })
}

function Featured({
  row,
  layout,
  weak,
}: {
  row: DrillRow
  layout: Layout
  weak: Parameters<typeof drillGoal>[2]
}) {
  const start = useStart(row.drill.id)
  const name = drillName(row.drill)
  const key = row.drill.focus?.kind === 'key' ? row.drill.focus.value : null
  const chip = stateChip(row.state)
  return (
    <article className="wfeature" data-testid="words-featured" aria-labelledby="words-featured">
      <div className="wfeature__top">
        <span className="wfeature__tag">{chip.label}</span>
      </div>
      <h3 id="words-featured" className="wfeature__title">
        {key === null
          ? m.path_words_featured_first()
          : m.path_words_featured_new({ key: glyph(key) })}
      </h3>
      <p className="wfeature__words" lang={layout.language}>
        {row.preview.slice(0, 6).map((word, i) => (
          <span key={word} style={{ ['--i' as string]: i }}>
            {displayWord(word)}
          </span>
        ))}
      </p>
      <div className="wfeature__foot">
        <p className="wfeature__goal">{drillGoal(row.drill, layout, weak)}</p>
        <Button
          size="lg"
          className="wfeature__cta"
          aria-label={m.path_words_start_named({ name })}
          onClick={start}
        >
          {m.path_words_start()}
        </Button>
      </div>
    </article>
  )
}

function stateChip(state: DrillState): { tone: ChipTone; label: string } {
  switch (state.kind) {
    case 'complete':
      return { tone: 'sage', label: m.path_words_state_complete() }
    case 'inProgress':
      return {
        tone: 'neutral',
        label: m.path_words_state_inProgress({ count: state.count, target: MASTERY_STREAK }),
      }
    case 'notStarted':
      return { tone: 'neutral', label: m.path_words_state_notStarted() }
    case 'thin':
      return { tone: 'muted', label: m.path_words_state_thin() }
    default:
      return { tone: 'muted', label: m.path_words_state_locked() }
  }
}

function lockText(row: DrillRow): string | null {
  const { state } = row
  if (state.kind === 'lockedKeys') {
    const keys = state.keys.map((key) => `«${glyph(key)}»`)
    return keys.length === 1
      ? m.path_words_lock_key({ key: keys[0] ?? '' })
      : m.path_words_lock_keys({ keys: keys.join(' ') })
  }
  if (state.kind === 'lockedAfter') return m.path_words_lock_after({ name: drillName(state.after) })
  if (state.kind === 'thin') {
    return row.drill.kind === 'weak' ? m.path_words_lock_weak() : m.path_words_lock_thin()
  }
  return null
}

/** Four words to show beside a drill, preferring real words over one-letter ones. */
function specimen(preview: readonly string[]): readonly string[] {
  const longer = preview.filter((word) => [...word].length > 1)
  return (longer.length >= 3 ? longer : preview).slice(0, 4)
}

function DrillItem({
  row,
  layout,
  weak,
  order,
}: {
  row: DrillRow
  layout: Layout
  weak: Parameters<typeof drillGoal>[2]
  order: number
}) {
  const start = useStart(row.drill.id)
  const name = drillName(row.drill)
  const chip = stateChip(row.state)
  const lock = lockText(row)
  const open = isOpenState(row.state)
  return (
    <li
      className="wrow"
      data-state={row.state.kind}
      data-drill-id={row.drill.id}
      style={{ ['--i' as string]: order }}
    >
      <div className="wrow__main">
        <p className="wrow__name">{name}</p>
        <p className="wrow__goal">{lock ?? drillGoal(row.drill, layout, weak)}</p>
      </div>
      <p className="wrow__words" lang={layout.language}>
        {open ? specimen(row.preview).map(displayWord).join('  ') : ''}
      </p>
      <div className="wrow__side">
        <Chip tone={chip.tone}>{chip.label}</Chip>
        {open ? (
          <Button size="sm" aria-label={m.path_words_start_named({ name })} onClick={start}>
            {m.path_words_start()}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
