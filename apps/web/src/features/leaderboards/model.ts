import type { Board, BoardScope } from '../../sync/groups.js'

/**
 * The leaderboard's own reading of a board: where the learner stands and which board opens first.
 */

export interface Standing {
  readonly place: number
  /** Racers on this board. */
  readonly of: number
  /** The racer one place up and the speed between, or `null` on first place. */
  readonly ahead: { readonly nickname: string; readonly gap: number } | null
}

export function myStanding(board: Board): Standing | null {
  if (board.me === null) return null
  const index = board.rows.findIndex((row) => row.userId === board.me)
  const mine = board.rows[index]
  if (mine === undefined) return null
  const above = board.rows[index - 1]
  return {
    place: mine.place,
    of: board.rows.length,
    ahead:
      above === undefined
        ? null
        : { nickname: above.nickname, gap: Math.max(0, Math.round(above.spm - mine.spm)) },
  }
}

/**
 * The board that opens when the address names none: the learner's group once they have one,
 * otherwise this week's — the two that change often enough to be worth opening.
 */
export function defaultScope(asked: BoardScope | undefined, groups: number | null): BoardScope {
  if (asked !== undefined) return asked
  return groups !== null && groups > 0 ? 'group' : 'week'
}
