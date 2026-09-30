import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import { buttonClass, cx } from '@typing-race/ui'
import { useEffect, useState } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import type { Board, BoardRow, BoardScope, GroupSummary, GroupsBackend } from '../../sync/groups.js'
import { WithGroups } from '../groups/shared.js'
import './leaderboards.css'

/**
 * Leaderboards, read like the results board after a race rather than like a table: huge places,
 * the podium given its weight, the learner's own row in red. Every row is a server-validated race
 * result; the note under the board says so, and says that practice is never ranked.
 */

/** Validated in the router, which must not import this lazy module to do it. */
interface BoardSearch {
  readonly scope?: BoardScope
  readonly layout?: 'yq' | 'qwerty'
  readonly group?: string
}

export function LeaderboardsScreen() {
  return <WithGroups>{(backend) => <Boards backend={backend} />}</WithGroups>
}

const SCOPES: readonly { value: BoardScope; label: () => string }[] = [
  { value: 'group', label: m.lb_scope_group },
  { value: 'week', label: m.lb_scope_week },
  { value: 'all', label: m.lb_scope_all },
]

type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'no-group' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly board: Board }

function Boards({ backend }: { readonly backend: GroupsBackend }) {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as BoardSearch
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const [groups, setGroups] = useState<readonly GroupSummary[] | null>(null)
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    backend
      .myGroups()
      .then((found) => live && setGroups(found))
      .catch(() => live && setGroups([]))
    return () => {
      live = false
    }
  }, [backend])

  const language: Language =
    search.layout === undefined ? typingLanguage : search.layout === 'yq' ? 'uk' : 'en'
  const scope: BoardScope =
    search.scope ?? (groups !== null && groups.length > 0 ? 'group' : 'week')
  const groupId =
    groups?.find((group) => group.id === search.group)?.id ?? search.group ?? groups?.[0]?.id

  useEffect(() => {
    if (groups === null) return
    let live = true
    setLoaded({ kind: 'loading' })
    if (scope === 'group' && groupId === undefined) {
      setLoaded({ kind: 'no-group' })
      return
    }
    backend
      .board(scope, language, scope === 'group' ? groupId : undefined)
      .then((board) => live && setLoaded({ kind: 'ready', board }))
      .catch(() => live && setLoaded({ kind: 'failed' }))
    return () => {
      live = false
    }
  }, [backend, groups, scope, language, groupId])

  const set = (next: BoardSearch) =>
    void navigate({
      to: '/leaderboards',
      search: {
        scope,
        layout: language === 'uk' ? 'yq' : 'qwerty',
        ...(groupId === undefined ? {} : { group: groupId }),
        ...next,
      },
      replace: true,
    })

  const board = loaded.kind === 'ready' ? loaded.board : null

  return (
    <div className="lb">
      <section className="lb-panel" aria-labelledby="lb-title">
        <div className="lb-panel__top">
          <h1 id="lb-title" className="lb-panel__title">
            {m.lb_title()}
          </h1>
          <p className="lb-panel__lede">
            {m.lb_lede()}
            {scope === 'week' && board !== null ? (
              <span className="lb-panel__since">
                {m.lb_week_since({ date: day(board.weekStart) })}
              </span>
            ) : null}
          </p>
        </div>

        <div className="lb-controls">
          <fieldset className="lb-seg">
            <legend className="sr-only">{m.lb_scope_label()}</legend>
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                className="lb-seg__btn"
                aria-pressed={option.value === scope}
                onClick={() => set({ scope: option.value })}
              >
                {option.label()}
              </button>
            ))}
          </fieldset>
          <fieldset className="lb-seg lb-seg--layout">
            <legend className="sr-only">{m.lb_layout_label()}</legend>
            {(['uk', 'en'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="lb-seg__btn"
                aria-pressed={value === language}
                onClick={() => set({ layout: value === 'uk' ? 'yq' : 'qwerty' })}
              >
                {value === 'uk' ? 'ЙЦУКЕН' : 'QWERTY'}
              </button>
            ))}
          </fieldset>
          {scope === 'group' && groups !== null && groups.length > 1 ? (
            <label className="lb-select">
              <span className="sr-only">{m.lb_group_label()}</span>
              <select value={groupId} onChange={(event) => set({ group: event.target.value })}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {scope === 'group' && groups !== null && groups.length === 1 && groups[0] ? (
            <Link to="/groups/$groupId" params={{ groupId: groups[0].id }} className="lb-context">
              {groups[0].name}
            </Link>
          ) : null}
        </div>
      </section>

      {loaded.kind === 'loading' ? (
        <ol className="lb-board" aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <li key={n} className="lb-skeleton" />
          ))}
        </ol>
      ) : loaded.kind === 'no-group' ? (
        <div className="lb-empty">
          <p>{m.lb_no_group()}</p>
          <Link to="/groups" className={buttonClass('primary', 'lg')}>
            {m.lb_no_group_action()}
          </Link>
        </div>
      ) : loaded.kind === 'failed' ? (
        <div className="lb-empty">
          <p role="alert">{m.community_error_generic()}</p>
        </div>
      ) : loaded.board.rows.length === 0 ? (
        <div className="lb-empty">
          <p>{m.lb_empty()}</p>
          <Link to="/races" className={buttonClass('primary', 'lg')}>
            {m.lb_empty_action()}
          </Link>
        </div>
      ) : (
        <BoardList board={loaded.board} />
      )}

      <footer className="lb-foot">
        <p className="lb-honest">{m.lb_honest()}</p>
        <Link to="/groups" className={buttonClass('secondary', 'md')}>
          {m.lb_groups_link()}
        </Link>
      </footer>
    </div>
  )
}

function BoardList({ board }: { readonly board: Board }) {
  return (
    <div className="lb-boardwrap">
      <div className="lb-heads" aria-hidden="true">
        <span>{m.lb_col_place()}</span>
        <span>{m.lb_col_name()}</span>
        <span className="lb-heads__num">{m.lb_col_spm()}</span>
        <span className="lb-heads__num">{m.lb_col_accuracy()}</span>
        <span className="lb-heads__num lb-heads__date">{m.lb_col_date()}</span>
      </div>
      <ol className="lb-board" data-testid="leaderboard">
        {board.rows.map((row, index) => (
          <Row key={row.userId} row={row} me={row.userId === board.me} index={index} />
        ))}
      </ol>
    </div>
  )
}

function Row({
  row,
  me,
  index,
}: {
  readonly row: BoardRow
  readonly me: boolean
  readonly index: number
}) {
  const podium = row.place <= 3 ? row.place : null
  return (
    <li
      className={cx('lb-row', podium !== null && `lb-row--p${podium}`, me && 'lb-row--me')}
      style={{ '--i': index } as React.CSSProperties}
      data-testid="leaderboard-row"
      data-me={me || undefined}
    >
      <span className="lb-row__place">
        <span className="sr-only">{m.lb_col_place()} </span>
        {row.place}
      </span>
      <span className="lb-row__who">
        <span className="lb-row__name">{row.nickname}</span>
        <span className="lb-row__sub">
          {me ? <span className="lb-row__you">{m.lb_you()}</span> : null}
          {m.lb_races({ count: row.races })}
        </span>
      </span>
      <span className="lb-row__fig lb-row__fig--spm">
        <strong>{Math.round(row.spm)}</strong>
        <span>{m.lb_col_spm()}</span>
      </span>
      <span className="lb-row__fig">
        <strong>{percent(row.accuracy)}</strong>
        <span>{m.lb_col_accuracy()}</span>
      </span>
      <span className="lb-row__date">{day(row.finishedAt)}</span>
    </li>
  )
}

function percent(accuracy: number): string {
  return `${(Math.floor(accuracy * 1000) / 10).toFixed(1)}%`
}

function day(iso: string): string {
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en-GB' : 'uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}
