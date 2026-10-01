import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { Language } from '@typing-race/domain'
import { buttonClass, cx } from '@typing-race/ui'
import { useEffect, useState } from 'react'
import { Panel, Screen, ScreenHead } from '../../app/Screen.js'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import type { Board, BoardRow, BoardScope, GroupSummary, GroupsBackend } from '../../sync/groups.js'
import { CommunityTabs, WithGroups } from '../groups/shared.js'
import { defaultScope, myStanding } from './model.js'
import './leaderboards.css'

/**
 * Leaderboards in direction B: the head bar with the Community switch, a bar of switches (which
 * board, which layout, which group), the standings in a white panel, and beside them the learner's
 * own place as the screen's one red block. Every row is a server-validated race result; the note
 * under "your place" says so, and says that practice is never ranked.
 *
 * With no board named in the address it opens on the learner's group, or on this week's board for
 * a learner without one (`defaultScope`).
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
  const scope = defaultScope(search.scope, groups === null ? null : groups.length)
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
    <Screen className="lb">
      <ScreenHead
        title={m.lb_title()}
        titleId="lb-title"
        lead={
          <>
            {m.lb_lede()}
            {scope === 'week' && board !== null ? (
              <span className="lb-since"> {m.lb_week_since({ date: day(board.weekStart) })}</span>
            ) : null}
          </>
        }
      >
        <CommunityTabs current="/leaderboards" />
      </ScreenHead>

      <div className="scr-panel lb-controls">
        <fieldset className="scr-seg">
          <legend className="sr-only">{m.lb_scope_label()}</legend>
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              className="scr-seg__btn"
              aria-pressed={option.value === scope}
              onClick={() => set({ scope: option.value })}
            >
              {option.label()}
            </button>
          ))}
        </fieldset>
        <fieldset className="scr-seg lb-seg--layout">
          <legend className="sr-only">{m.lb_layout_label()}</legend>
          {(['uk', 'en'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="scr-seg__btn"
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

      <div className="lb-grid">
        <Panel
          id="lb-board-title"
          n={1}
          title={m.lb_board_title()}
          meta={board === null ? undefined : m.lb_board_meta({ count: board.rows.length })}
          className="lb-board-panel"
        >
          {loaded.kind === 'loading' ? (
            <ol className="scr-rows lb-board" aria-busy="true">
              {[0, 1, 2, 3].map((n) => (
                <li key={n} className="scr-skeleton" />
              ))}
            </ol>
          ) : loaded.kind === 'no-group' ? (
            <div className="scr-empty">
              <p className="scr-say">{m.lb_no_group()}</p>
              <Link to="/groups" className={buttonClass('secondary', 'md')}>
                {m.lb_no_group_action()}
              </Link>
            </div>
          ) : loaded.kind === 'failed' ? (
            <div className="scr-empty">
              <p role="alert" className="scr-error">
                {m.community_error_generic()}
              </p>
            </div>
          ) : loaded.board.rows.length === 0 ? (
            <div className="scr-empty">
              <p className="scr-say">{m.lb_empty()}</p>
              <Link to="/races" className={buttonClass('secondary', 'md')}>
                {m.lb_empty_action()}
              </Link>
            </div>
          ) : (
            <BoardList board={loaded.board} />
          )}
        </Panel>

        <div className="lb-side">
          <MyPlace board={board} />
          <Panel id="lb-how-title" n={3} title={m.lb_how_title()} className="lb-how">
            <p className="scr-note">{m.lb_honest()}</p>
            <Link to="/groups" className="lb-link">
              {m.lb_groups_link()} →
            </Link>
          </Panel>
        </div>
      </div>
    </Screen>
  )
}

/** The learner's own place: the screen's one red block. */
function MyPlace({ board }: { readonly board: Board | null }) {
  const standing = board === null ? null : myStanding(board)
  return (
    <section
      className="scr-panel scr-loud lb-me"
      aria-labelledby="lb-me-title"
      data-testid="leaderboard-me"
    >
      <div className="scr-panel__head">
        <span className="scr-idx">02</span>
        <h2 className="scr-panel__title" id="lb-me-title">
          {m.lb_me_title()}
        </h2>
      </div>
      {standing === null ? (
        <>
          <p className="lb-me__say">{m.lb_me_none()}</p>
          <Link to="/races" className="lb-me__go">
            {m.lb_me_race()}
          </Link>
        </>
      ) : (
        <>
          <p className="lb-me__place">
            <span className="num">{standing.place}</span>
            <span className="lb-me__of">{m.lb_me_place({ of: standing.of })}</span>
          </p>
          <p className="lb-me__say">
            {standing.ahead === null
              ? m.lb_me_first()
              : m.lb_me_ahead({ name: standing.ahead.nickname, gap: standing.ahead.gap })}
          </p>
        </>
      )}
    </section>
  )
}

function BoardList({ board }: { readonly board: Board }) {
  return (
    <>
      <div className="lb-heads" aria-hidden="true">
        <span>{m.lb_col_place()}</span>
        <span>{m.lb_col_name()}</span>
        <span className="lb-heads__num">{m.lb_col_spm()}</span>
        <span className="lb-heads__num">{m.lb_col_accuracy()}</span>
        <span className="lb-heads__num lb-heads__date">{m.lb_col_date()}</span>
      </div>
      <ol className="scr-rows lb-board" data-testid="leaderboard">
        {board.rows.map((row) => (
          <Row key={row.userId} row={row} me={row.userId === board.me} />
        ))}
      </ol>
    </>
  )
}

function Row({ row, me }: { readonly row: BoardRow; readonly me: boolean }) {
  const podium = row.place <= 3 ? row.place : null
  return (
    <li
      className={cx('scr-row lb-row', podium !== null && 'lb-row--podium', me && 'lb-row--me')}
      data-testid="leaderboard-row"
      data-me={me || undefined}
    >
      <span className="lb-row__place num">
        <span className="sr-only">{m.lb_col_place()} </span>
        {row.place}
      </span>
      <span className="lb-row__who">
        <span className="lb-row__name">{row.nickname}</span>
        <span className="lb-row__sub">
          {me ? <span className="scr-tag scr-tag--ink">{m.lb_you()}</span> : null}
          {m.lb_races({ count: row.races })}
        </span>
      </span>
      <span className="lb-row__fig lb-row__fig--spm num">
        {Math.round(row.spm)}
        <span className="lb-row__unit">{m.lb_col_spm()}</span>
      </span>
      <span className="lb-row__fig num">
        {percent(row.accuracy)}
        <span className="lb-row__unit">{m.lb_col_accuracy()}</span>
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
