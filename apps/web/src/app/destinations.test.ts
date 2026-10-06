import { describe, expect, it } from 'vitest'
import { DESTINATIONS, destinationOf, isOutsideFrame, needsKeyboard } from './destinations.js'
import { seasonOf } from './Rail.js'

describe('the five destinations', () => {
  it('are numbered 1 to 5 in rail order', () => {
    expect(DESTINATIONS.map((d) => [d.key, d.id])).toEqual([
      [1, 'home'],
      [2, 'map'],
      [3, 'races'],
      [4, 'community'],
      [5, 'profile'],
    ])
  })

  it.each([
    ['/', 'home'],
    ['/today', 'home'],
    ['/map', 'map'],
    ['/path', 'map'],
    ['/academy', 'map'],
    ['/academy/uk.m1.e1', 'map'],
    ['/review', 'map'],
    ['/exercise/yq.run.anchors', 'map'],
    ['/races', 'races'],
    ['/races/room/abc', 'races'],
    ['/groups', 'community'],
    ['/groups/join/X1', 'community'],
    ['/leaderboards', 'community'],
    ['/profile', 'profile'],
    ['/settings', null],
    ['/formulas', null],
    ['/pathology', null],
  ] as const)('%s belongs to %s', (pathname, id) => {
    expect(destinationOf(pathname)).toBe(id)
  })

  it('asks for a physical keyboard on training routes only', () => {
    for (const path of [
      '/',
      '/map',
      '/path',
      '/exercise/x',
      '/session',
      '/races/room/r',
      '/sprint',
      '/daily',
      '/own',
    ]) {
      expect(needsKeyboard(path)).toBe(true)
    }
    for (const path of [
      '/profile',
      '/leaderboards',
      '/groups',
      '/races',
      '/settings',
      '/result/a',
    ]) {
      expect(needsKeyboard(path)).toBe(false)
    }
  })

  it('draws the product page outside the frame', () => {
    expect(isOutsideFrame('/about')).toBe(true)
    expect(isOutsideFrame('/about/project')).toBe(false)
  })
})

describe('the season', () => {
  it('is a calendar month counted from October 2026', () => {
    expect(seasonOf(new Date(2026, 9, 1))).toEqual({ number: 1, daysLeft: 31, elapsed: 0 })
    expect(seasonOf(new Date(2026, 10, 30)).number).toBe(2)
    expect(seasonOf(new Date(2027, 0, 31))).toMatchObject({ number: 4, daysLeft: 1 })
  })
})
