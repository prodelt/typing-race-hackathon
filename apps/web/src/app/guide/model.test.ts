import { afterEach, describe, expect, it } from 'vitest'
import {
  autoShowAllowed,
  closeGuide,
  guideTarget,
  isSeen,
  markSeen,
  presentSteps,
  readSeen,
  replayGuide,
  useGuide,
} from './model'

const KEY = 'typing-race:guide-seen'

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  useGuide.setState({ screen: null, open: false })
})

describe('the seen flag', () => {
  it('starts unseen and remembers each screen on its own', () => {
    expect(isSeen('home')).toBe(false)
    markSeen('home')
    markSeen('map')
    expect(isSeen('home')).toBe(true)
    expect(isSeen('result')).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ home: true, map: true })
  })

  it('treats broken storage as nothing seen', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readSeen()).toEqual({})
    localStorage.setItem(KEY, '[1,2]')
    expect(readSeen()).toEqual({})
    markSeen('map')
    expect(isSeen('map')).toBe(true)
  })

  it('closing the guide marks the screen seen; replay opens it again', () => {
    useGuide.setState({ screen: 'map', open: true })
    closeGuide()
    expect(useGuide.getState().open).toBe(false)
    expect(isSeen('map')).toBe(true)
    replayGuide()
    expect(useGuide.getState().open).toBe(true)
  })

  it('replay does nothing where a screen has no guide', () => {
    replayGuide()
    expect(useGuide.getState().open).toBe(false)
  })
})

describe('step filtering', () => {
  it('skips a step whose target is missing', () => {
    document.body.innerHTML = '<div data-guide="a">A</div><div data-guide="c">C</div>'
    // jsdom has no layout, so every element counts as shown.
    for (const el of document.querySelectorAll('div'))
      el.getClientRects = () => [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList
    const steps = [
      { target: guideTarget('a'), text: 'a' },
      { target: guideTarget('b'), text: 'b' },
      { target: guideTarget('c'), text: 'c' },
    ]
    expect(presentSteps(steps, (s) => document.querySelector(s)).map((s) => s.text)).toEqual([
      'a',
      'c',
    ])
  })

  it('skips a step whose target is not rendered', () => {
    document.body.innerHTML = '<div data-guide="a">A</div>'
    const el = document.querySelector('div')
    if (el !== null) el.getClientRects = () => [] as unknown as DOMRectList
    expect(
      presentSteps([{ target: guideTarget('a'), text: 'a' }], (s) => document.querySelector(s)),
    ).toEqual([])
  })
})

describe('auto-show', () => {
  it('never opens by itself in an automated browser', () => {
    expect(autoShowAllowed({ webdriver: true } as Navigator)).toBe(false)
    expect(autoShowAllowed({ webdriver: false } as Navigator)).toBe(true)
    expect(autoShowAllowed(undefined)).toBe(true)
  })
})
