import { describe, expect, it } from 'vitest'
import type { Board, BoardRow } from '../../sync/groups'
import { defaultScope, myStanding } from './model'

function row(place: number, userId: string, spm: number): BoardRow {
  return {
    place,
    userId,
    nickname: userId.toUpperCase(),
    spm,
    accuracy: 0.97,
    score: spm,
    races: 1,
    finishedAt: '2026-09-30T10:00:00Z',
  }
}

function board(me: string | null, rows: BoardRow[]): Board {
  return { scope: 'week', language: 'uk', weekStart: '2026-09-28', me, rows }
}

describe('myStanding', () => {
  it('is null for a visitor with no identity or no row on this board', () => {
    expect(myStanding(board(null, [row(1, 'a', 300)]))).toBeNull()
    expect(myStanding(board('z', [row(1, 'a', 300)]))).toBeNull()
  })

  it('gives the place, the field size and how far the next place up is', () => {
    const standing = myStanding(
      board('c', [row(1, 'a', 320), row(2, 'b', 301.6), row(3, 'c', 290)]),
    )
    expect(standing).toEqual({ place: 3, of: 3, ahead: { nickname: 'B', gap: 12 } })
  })

  it('has nobody ahead on first place', () => {
    expect(myStanding(board('a', [row(1, 'a', 320), row(2, 'b', 300)]))).toEqual({
      place: 1,
      of: 2,
      ahead: null,
    })
  })

  it('never reports a negative gap when a weighted score puts a slower racer ahead', () => {
    const standing = myStanding(board('b', [row(1, 'a', 280), row(2, 'b', 300)]))
    expect(standing?.ahead?.gap).toBe(0)
  })
})

describe('defaultScope', () => {
  it('is the group board for a member of a group and the weekly board otherwise', () => {
    expect(defaultScope(undefined, 2)).toBe('group')
    expect(defaultScope(undefined, 0)).toBe('week')
    expect(defaultScope(undefined, null)).toBe('week')
  })

  it('keeps a scope asked for in the address', () => {
    expect(defaultScope('all', 3)).toBe('all')
    expect(defaultScope('group', 0)).toBe('group')
  })
})
